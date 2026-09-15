#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_ROOT="/var/www/ody"
readonly RELEASES_DIR="${DEPLOY_ROOT}/releases"
readonly CURRENT_LINK="${DEPLOY_ROOT}/current"
readonly PREVIOUS_LINK="${DEPLOY_ROOT}/previous"

readonly FRONTEND_SERVICE="ody-frontend.service"
readonly LOCAL_BASE_URL="http://127.0.0.1:3000"
readonly PUBLIC_BASE_URL="${ODY_FRONTEND_PUBLIC_BASE_URL:-https://j15a405.p.ssafy.io}"

readonly LOCK_FILE="/run/lock/ody-frontend-deploy.lock"
readonly RETAIN_RELEASES=5


log() {
    printf '[frontend-deploy] %s\n' "$*"
}


fail() {
    printf '[frontend-deploy] ERROR: %s\n' "$*" >&2
    exit 1
}


usage() {
    cat <<'EOF'
Usage:
  deploy.sh deploy <artifact.tar.gz> <release-id>
  deploy.sh rollback [release-id]
  deploy.sh status
EOF
}


require_root() {
    if [[ ${EUID} -ne 0 ]]; then
        exec sudo -n "$0" "$@"
    fi
}


validate_release_id() {
    [[ $1 =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || \
        fail "Invalid release id."
}


assert_layout() {
    [[ ${DEPLOY_ROOT} == "/var/www/ody" ]] || \
        fail "Unexpected deploy root."

    [[ ${RELEASES_DIR} == "${DEPLOY_ROOT}/releases" ]] || \
        fail "Unexpected releases directory."
}


atomic_link() {
    local target=$1
    local link=$2
    local temporary="${link}.new.$$"

    rm -f -- "${temporary}"

    ln -s "${target}" "${temporary}"
    mv -Tf "${temporary}" "${link}"
}


link_target() {
    local link=$1

    if [[ -L ${link} ]]; then
        readlink -f "${link}"
    fi
}


validate_archive() {
    local artifact=$1
    local member

    [[ -f ${artifact} && -r ${artifact} ]] || \
        fail "Artifact is not readable: ${artifact}"

    tar -tzf "${artifact}" >/dev/null || \
        fail "Artifact is not a readable gzip tar archive."

    while IFS= read -r member; do
        [[ ${member} != /* ]] || \
            fail "Artifact contains an absolute path."

        [[ ${member} != ".." &&
           ${member} != ../* &&
           ${member} != */../* ]] || \
            fail "Artifact contains a parent-directory path."
    done < <(tar -tzf "${artifact}")
}


validate_release() {
    local directory=$1
    local release_id=$2

    [[ -d ${directory} ]] || \
        fail "Release directory is missing: ${directory}"

    # Next.js standalone 실행 파일
    [[ -s ${directory}/server.js ]] || \
        fail "server.js is missing or empty."

    # Next.js static asset
    [[ -d ${directory}/.next/static ]] || \
        fail ".next/static directory is missing."

    # Jenkins에서 생성한 health marker
    [[ -f ${directory}/public/healthz.txt ]] || \
        fail "public/healthz.txt is missing."

    [[ $(tr -d '\r\n' < "${directory}/public/healthz.txt") == "ok" ]] || \
        fail "Invalid health marker."

    # Jenkins Build Number
    [[ -f ${directory}/public/build-id.txt ]] || \
        fail "public/build-id.txt is missing."

    [[ $(tr -d '\r\n' < "${directory}/public/build-id.txt") == "${release_id}" ]] || \
        fail "Artifact build id does not match the requested release id."
}


nginx_check() {
    nginx -t
}

frontend_service_exists() {
    systemctl cat "${FRONTEND_SERVICE}" >/dev/null 2>&1
}


restart_frontend() {
    if ! frontend_service_exists; then
        log "Frontend systemd service does not exist: ${FRONTEND_SERVICE}"
        return 1
    fi

    log "Restarting ${FRONTEND_SERVICE}"

    if ! systemctl restart "${FRONTEND_SERVICE}"; then
        systemctl status "${FRONTEND_SERVICE}" --no-pager || true
        return 1
    fi

    if ! systemctl is-active --quiet "${FRONTEND_SERVICE}"; then
        systemctl status "${FRONTEND_SERVICE}" --no-pager || true
        return 1
    fi

    return 0
}


wait_local_health() {
    local release_id=$1
    local marker
    local attempt

    log "Waiting for Next.js server on ${LOCAL_BASE_URL}"

    for attempt in $(seq 1 30); do
        if curl -fsS \
            --max-time 3 \
            "${LOCAL_BASE_URL}/healthz.txt" \
            >/dev/null 2>&1; then

            marker="$(
                curl -fsS \
                    --max-time 3 \
                    "${LOCAL_BASE_URL}/build-id.txt" \
                    2>/dev/null || true
            )"

            if [[ $(tr -d '\r\n' <<<"${marker}") == "${release_id}" ]]; then
                log "Local Next.js health check passed: ${release_id}"
                return 0
            fi
        fi

        sleep 1
    done

    log "Local Next.js health check failed."

    systemctl status "${FRONTEND_SERVICE}" --no-pager || true
    journalctl -u "${FRONTEND_SERVICE}" -n 50 --no-pager || true

    return 1
}


public_health() {
    local release_id=$1
    local marker
    local actuator_status

    log "Checking public frontend."

    curl -fsS \
        --retry 5 \
        --retry-delay 1 \
        --max-time 10 \
        "${PUBLIC_BASE_URL}/" \
        >/dev/null

    marker="$(
        curl -fsS \
            --retry 5 \
            --retry-delay 1 \
            --max-time 10 \
            "${PUBLIC_BASE_URL}/build-id.txt?release=${release_id}"
    )"

    [[ $(tr -d '\r\n' <<<"${marker}") == "${release_id}" ]] || \
        return 1

    log "Checking backend API."

    curl -fsS \
        --retry 5 \
        --retry-delay 1 \
        --max-time 10 \
        "${PUBLIC_BASE_URL}/api/hello" \
        >/dev/null

    actuator_status="$(
        curl -sS \
            -o /dev/null \
            -w '%{http_code}' \
            --max-time 10 \
            "${PUBLIC_BASE_URL}/actuator/health"
    )"

    [[ ${actuator_status} == "403" || ${actuator_status} == "404" ]]
}


restore_links() {
    local old_current=$1
    local old_previous=$2

    if [[ -n ${old_current} && -d ${old_current} ]]; then
        atomic_link "${old_current}" "${CURRENT_LINK}"
    else
        rm -f -- "${CURRENT_LINK}"
    fi

    if [[ -n ${old_previous} && -d ${old_previous} ]]; then
        atomic_link "${old_previous}" "${PREVIOUS_LINK}"
    else
        rm -f -- "${PREVIOUS_LINK}"
    fi
}


safe_remove_release() {
    local directory=$1

    [[ ${directory} == "${RELEASES_DIR}/"* ]] || \
        fail "Refusing to remove a path outside releases."

    [[ ${directory} != "${RELEASES_DIR}" ]] || \
        fail "Refusing to remove the releases root."

    rm -rf -- "${directory}"
}


prune_releases() {
    local current_target
    local previous_target
    local kept=0
    local entry
    local path

    current_target="$(link_target "${CURRENT_LINK}")"
    previous_target="$(link_target "${PREVIOUS_LINK}")"

    while IFS= read -r entry; do
        path="${entry#* }"

        if [[ ${path} == "${current_target}" ||
              ${path} == "${previous_target}" ]]; then
            continue
        fi

        kept=$((kept + 1))

        if (( kept > RETAIN_RELEASES )); then
            log "Removing old release: $(basename "${path}")"
            safe_remove_release "${path}"
        fi
    done < <(
        find "${RELEASES_DIR}" \
            -mindepth 1 \
            -maxdepth 1 \
            -type d \
            ! -name '.incoming-*' \
            -printf '%T@ %p\n' |
            sort -nr
    )
}


deploy_release() {
    local artifact=$1
    local release_id=$2

    local release_dir
    local incoming
    local old_current
    local old_previous

    validate_release_id "${release_id}"
    validate_archive "${artifact}"

    release_dir="${RELEASES_DIR}/${release_id}"
    incoming="${RELEASES_DIR}/.incoming-${release_id}-$$"

    install -d \
        -o root \
        -g www-data \
        -m 0755 \
        "${DEPLOY_ROOT}" \
        "${RELEASES_DIR}"

    old_current="$(link_target "${CURRENT_LINK}")"
    old_previous="$(link_target "${PREVIOUS_LINK}")"

    if [[ -e ${release_dir} ]]; then
        validate_release "${release_dir}" "${release_id}"

        log "Using existing immutable release: ${release_id}"
    else
        install -d \
            -o root \
            -g www-data \
            -m 0755 \
            "${incoming}"

        trap '
            if [[ -n ${incoming:-} && -d ${incoming} ]]; then
                safe_remove_release "${incoming}"
            fi
        ' EXIT

        tar \
            -xzf "${artifact}" \
            -C "${incoming}" \
            --no-same-owner

        validate_release "${incoming}" "${release_id}"

        # 디렉터리는 읽기/탐색 가능하게 유지
        find "${incoming}" \
            -type d \
            -exec chmod 0755 {} +

        # 실행 비트는 보존하고 group/other write 권한만 제거
        find "${incoming}" \
            -type f \
            -exec chmod go-w {} +

        chown -R root:www-data "${incoming}"

        # Next.js runtime cache는 서비스 프로세스가 쓸 수 있게 한다.
        install -d \
            -o www-data \
            -g www-data \
            -m 0755 \
            "${incoming}/.next/cache"

        mv "${incoming}" "${release_dir}"

        incoming=""

        trap - EXIT
    fi

    nginx_check

    if [[ -n ${old_current} && -d ${old_current} ]]; then
        atomic_link "${old_current}" "${PREVIOUS_LINK}"
    fi

    atomic_link "${release_dir}" "${CURRENT_LINK}"

    # 새 current를 기준으로 Next.js 재시작
    # Nginx 설정은 Backend 블루그린이 관리하므로 여기서 건드리지 않는다 (S15P21A405-357)
    if ! restart_frontend ||
        ! wait_local_health "${release_id}" ||
        ! public_health "${release_id}"; then

        log "Health verification failed; restoring previous symlinks."

        restore_links "${old_current}" "${old_previous}"

        # 이전 release가 Next.js라면 이전 Next 서버로 복구
        if [[ -n ${old_current} &&
            -s ${old_current}/server.js ]]; then

            log "Restoring previous Next.js release."

            systemctl restart "${FRONTEND_SERVICE}" || true
            wait_local_health "$(basename "${old_current}")" || true

        else
            log "No previous Next.js release to restore; stopping ${FRONTEND_SERVICE}."

            systemctl stop "${FRONTEND_SERVICE}" || true
        fi

        fail "Deployment rolled back."
    fi

    systemctl enable "${FRONTEND_SERVICE}"

    prune_releases

    log "Deployment successful: ${release_id}"
}


rollback_release() {
    local requested=${1:-}

    local target
    local release_id
    local old_current
    local old_previous

    old_current="$(link_target "${CURRENT_LINK}")"
    old_previous="$(link_target "${PREVIOUS_LINK}")"

    [[ -n ${old_current} ]] || \
        fail "There is no active release."

    if [[ -n ${requested} ]]; then
        validate_release_id "${requested}"
        target="${RELEASES_DIR}/${requested}"
    else
        target="${old_previous}"
    fi

    [[ -n ${target} && -d ${target} ]] || \
        fail "Rollback release is unavailable."

    [[ ${target} != "${old_current}" ]] || \
        fail "Requested release is already active."

    release_id="$(basename "${target}")"

    validate_release "${target}" "${release_id}"

    nginx_check

    atomic_link "${old_current}" "${PREVIOUS_LINK}"
    atomic_link "${target}" "${CURRENT_LINK}"

    if ! restart_frontend ||
       ! wait_local_health "${release_id}" ||
       ! nginx_check ||
       ! public_health "${release_id}"; then

        log "Rollback verification failed; restoring original symlinks."

        restore_links "${old_current}" "${old_previous}"

        systemctl restart "${FRONTEND_SERVICE}" || true

        nginx_check || true

        fail "Rollback was not applied."
    fi

    log "Rollback successful: ${release_id}"
}


show_status() {
    printf 'current=%s\n' "$(link_target "${CURRENT_LINK}")"
    printf 'previous=%s\n' "$(link_target "${PREVIOUS_LINK}")"

    if frontend_service_exists; then
        printf 'service=%s\n' "$(
            systemctl is-active "${FRONTEND_SERVICE}" 2>/dev/null || true
        )"
    else
        printf 'service=missing\n'
    fi

    if [[ -d ${RELEASES_DIR} ]]; then
        printf '%s\n' 'releases:'

        find "${RELEASES_DIR}" \
            -mindepth 1 \
            -maxdepth 1 \
            -type d \
            ! -name '.incoming-*' \
            -printf '  %f\n' |
            sort
    fi
}


main() {
    local action=${1:-}

    shift || true

    assert_layout
    require_root "${action}" "$@"

    for command_name in \
        tar \
        nginx \
        curl \
        flock \
        find \
        sort \
        readlink \
        install \
        mv \
        ln \
        systemctl \
        journalctl \
        seq; do

        command -v "${command_name}" >/dev/null || \
            fail "Required command is missing: ${command_name}"
    done

    exec 9>"${LOCK_FILE}"

    flock -n 9 || \
        fail "Another Frontend deployment is running."

    case "${action}" in
        deploy)
            [[ $# -eq 2 ]] || {
                usage
                exit 2
            }

            deploy_release "$1" "$2"
            ;;

        rollback)
            [[ $# -le 1 ]] || {
                usage
                exit 2
            }

            rollback_release "${1:-}"
            ;;

        status)
            [[ $# -eq 0 ]] || {
                usage
                exit 2
            }

            show_status
            ;;

        *)
            usage
            exit 2
            ;;
    esac
}


main "$@"