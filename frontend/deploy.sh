#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_ROOT="/var/www/ody"
readonly RELEASES_DIR="${DEPLOY_ROOT}/releases"
readonly CURRENT_LINK="${DEPLOY_ROOT}/current"
readonly PREVIOUS_LINK="${DEPLOY_ROOT}/previous"
readonly PUBLIC_BASE_URL="${ODY_FRONTEND_PUBLIC_BASE_URL:-https://j15a405.p.ssafy.io}"


readonly NGINX_CONFIG="/etc/nginx/sites-available/backend"
readonly NGINX_NEXT_CONFIG="/etc/nginx/sites-available/backend.next"
readonly NGINX_LEGACY_BACKUP="/etc/nginx/sites-available/backend.before-next"

# NGINX_CONFIG는 backend blue-green upstream, TLS, Certbot 등과 프론트 location을
# 한 파일에 같이 담고 있다. Frontend 배포는 이 마커 사이의 프론트 location 블록만
# 이식하고, 그 바깥(특히 backend upstream 줄)은 절대 건드리지 않는다 — 그 줄의
# 소유권은 backend/deploy.sh(blue-green)에만 있다.
readonly NGINX_FRONTEND_BLOCK_BEGIN='# BEGIN ODY-FRONTEND-LOCATIONS (managed by frontend/deploy.sh; do not edit by hand)'
readonly NGINX_FRONTEND_BLOCK_END='# END ODY-FRONTEND-LOCATIONS'

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
    [[ $1 =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail "Invalid release id."
}

assert_layout() {
    [[ ${DEPLOY_ROOT} == "/var/www/ody" ]] || fail "Unexpected deploy root."
    [[ ${RELEASES_DIR} == "${DEPLOY_ROOT}/releases" ]] || fail "Unexpected releases directory."
}

atomic_link() {
    local target=$1
    local link=$2
    local temporary="${link}.new.$$"

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

    [[ -f ${artifact} && -r ${artifact} ]] || fail "Artifact is not readable: ${artifact}"
    tar -tzf "${artifact}" >/dev/null || fail "Artifact is not a readable gzip tar archive."

    while IFS= read -r member; do
        [[ ${member} != /* ]] || fail "Artifact contains an absolute path."
        [[ ${member} != ".." && ${member} != ../* && ${member} != */../* ]] || \
            fail "Artifact contains a parent-directory path."
    done < <(tar -tzf "${artifact}")

    if tar -tvzf "${artifact}" | grep -Eq '^[lh]'; then
        fail "Artifact must not contain symbolic or hard links."
    fi
}

validate_release() {
    local directory=$1
    local release_id=$2

    [[ -d ${directory} ]] || fail "Release directory is missing: ${directory}"
    [[ -s ${directory}/index.html ]] || fail "index.html is missing or empty."
    [[ -f ${directory}/healthz.txt ]] || fail "healthz.txt is missing."
    [[ $(tr -d '\r\n' < "${directory}/healthz.txt") == "ok" ]] || fail "Invalid health marker."
    [[ -f ${directory}/build-id.txt ]] || fail "build-id.txt is missing."
    [[ $(tr -d '\r\n' < "${directory}/build-id.txt") == "${release_id}" ]] || \
        fail "Artifact build id does not match the requested release id."
}

nginx_check() {
    nginx -t
}

extract_frontend_block() {
    local file=$1

    awk \
        -v begin="${NGINX_FRONTEND_BLOCK_BEGIN}" \
        -v end="${NGINX_FRONTEND_BLOCK_END}" \
        '
            $0 == begin { flag = 1 }
            flag { print }
            $0 == end { flag = 0 }
        ' \
        "${file}"
}


# template(NGINX_NEXT_CONFIG 또는 NGINX_LEGACY_BACKUP)의 마커 사이 블록을
# target(NGINX_CONFIG)의 같은 마커 사이에만 이식한 결과를 out에 만든다.
# 마커 바깥 내용(backend upstream, TLS, Certbot, /api/, /actuator/ 등)은
# target 그대로 보존된다. 마커가 없거나 개수가 안 맞으면 손대지 않고 실패한다.
splice_frontend_block() {
    local template=$1
    local target=$2
    local out=$3

    local block_file
    block_file="$(mktemp)"

    extract_frontend_block "${template}" > "${block_file}"

    if [[ ! -s ${block_file} ]]; then
        rm -f -- "${block_file}"
        fail "Frontend location markers are missing in ${template}."
    fi

    if [[ $(grep -c -F -x "${NGINX_FRONTEND_BLOCK_BEGIN}" "${template}") -ne 1 ||
          $(grep -c -F -x "${NGINX_FRONTEND_BLOCK_END}" "${template}") -ne 1 ]]; then
        rm -f -- "${block_file}"
        fail "Frontend location markers must appear exactly once in ${template}."
    fi

    if [[ $(grep -c -F -x "${NGINX_FRONTEND_BLOCK_BEGIN}" "${target}") -ne 1 ||
          $(grep -c -F -x "${NGINX_FRONTEND_BLOCK_END}" "${target}") -ne 1 ]]; then
        rm -f -- "${block_file}"
        fail "Frontend location markers are missing or duplicated in ${target}. Backend upstream/TLS/Certbot blocks are intentionally left untouched; add the markers there manually before deploying."
    fi

    local begin_line end_line

    begin_line="$(grep -n -F -x "${NGINX_FRONTEND_BLOCK_BEGIN}" "${target}" | cut -d: -f1)"
    end_line="$(grep -n -F -x "${NGINX_FRONTEND_BLOCK_END}" "${target}" | cut -d: -f1)"

    if [[ ${begin_line} -ge ${end_line} ]]; then
        rm -f -- "${block_file}"
        fail "Frontend location markers are out of order in ${target}."
    fi

    {
        head -n "$((begin_line - 1))" "${target}"
        cat "${block_file}"
        tail -n "+$((end_line + 1))" "${target}"
    } > "${out}"

    rm -f -- "${block_file}"
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

reload_nginx() {
    if [[ ! -f ${NGINX_NEXT_CONFIG} ]]; then
        log "Next.js Nginx configuration is unavailable: ${NGINX_NEXT_CONFIG}"
        return 1
    fi

    log "Updating frontend location blocks in Nginx configuration."

    local candidate backup
    candidate="$(mktemp)"
    backup="$(mktemp)"

    splice_frontend_block "${NGINX_NEXT_CONFIG}" "${NGINX_CONFIG}" "${candidate}"

    cp "${NGINX_CONFIG}" "${backup}"
    cp "${candidate}" "${NGINX_CONFIG}"
    rm -f -- "${candidate}"

    if ! nginx_check; then
        log "Updated Nginx configuration is invalid; restoring previous configuration."
        cp "${backup}" "${NGINX_CONFIG}"
        rm -f -- "${backup}"
        return 1
    fi

    rm -f -- "${backup}"

    systemctl reload nginx
}

restore_legacy_nginx() {
    if [[ ! -f ${NGINX_LEGACY_BACKUP} ]]; then
        log "Legacy Nginx backup is unavailable: ${NGINX_LEGACY_BACKUP}"
        return 1
    fi

    log "Restoring legacy frontend location blocks in Nginx configuration."

    local candidate backup
    candidate="$(mktemp)"
    backup="$(mktemp)"

    splice_frontend_block "${NGINX_LEGACY_BACKUP}" "${NGINX_CONFIG}" "${candidate}"

    cp "${NGINX_CONFIG}" "${backup}"
    cp "${candidate}" "${NGINX_CONFIG}"
    rm -f -- "${candidate}"

    if ! nginx_check; then
        log "Restored legacy Nginx configuration is invalid; keeping previous configuration."
        cp "${backup}" "${NGINX_CONFIG}"
        rm -f -- "${backup}"
        return 1
    fi

    rm -f -- "${backup}"

    systemctl reload nginx
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

    curl -fsS --retry 5 --retry-delay 1 --max-time 10 "${PUBLIC_BASE_URL}/" >/dev/null
    marker="$(curl -fsS --retry 5 --retry-delay 1 --max-time 10 \
        "${PUBLIC_BASE_URL}/build-id.txt?release=${release_id}")"
    [[ $(tr -d '\r\n' <<<"${marker}") == "${release_id}" ]] || return 1

    # 백엔드 의존성 검사는 프론트엔드 배포 성공/실패 조건에서 제외
    # curl -fsS --retry 5 --retry-delay 1 --max-time 10 "${PUBLIC_BASE_URL}/api/hello" >/dev/null
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
    [[ ${directory} == "${RELEASES_DIR}/"* ]] || fail "Refusing to remove a path outside releases."
    [[ ${directory} != "${RELEASES_DIR}" ]] || fail "Refusing to remove the releases root."
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
        if [[ ${path} == "${current_target}" || ${path} == "${previous_target}" ]]; then
            continue
        fi
        kept=$((kept + 1))
        if (( kept > RETAIN_RELEASES )); then
            log "Removing old release: $(basename "${path}")"
            safe_remove_release "${path}"
        fi
    done < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d \
        ! -name '.incoming-*' -printf '%T@ %p\n' | sort -nr)
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

    install -d -o root -g www-data -m 0755 "${DEPLOY_ROOT}" "${RELEASES_DIR}"
    old_current="$(link_target "${CURRENT_LINK}")"
    old_previous="$(link_target "${PREVIOUS_LINK}")"

    if [[ -e ${release_dir} ]]; then
        validate_release "${release_dir}" "${release_id}"
        log "Using existing immutable release: ${release_id}"
    else
        install -d -o root -g www-data -m 0755 "${incoming}"
        trap 'if [[ -n ${incoming:-} && -d ${incoming} ]]; then safe_remove_release "${incoming}"; fi' EXIT
        tar -xzf "${artifact}" -C "${incoming}" --no-same-owner --no-same-permissions
        validate_release "${incoming}" "${release_id}"
        find "${incoming}" -type d -exec chmod 0755 {} +
        find "${incoming}" -type f -exec chmod 0644 {} +
        chown -R root:www-data "${incoming}"
        mv "${incoming}" "${release_dir}"
        incoming=""
        trap - EXIT
    fi

    nginx_check
    if [[ -n ${old_current} && -d ${old_current} ]]; then
        atomic_link "${old_current}" "${PREVIOUS_LINK}"
    fi
    atomic_link "${release_dir}" "${CURRENT_LINK}"

    if ! nginx_check || ! public_health "${release_id}"; then
        log "Health verification failed; restoring previous symlinks."
        restore_links "${old_current}" "${old_previous}"
        nginx_check
        [[ -z ${old_current} ]] || public_health "$(basename "${old_current}")" || true
        fail "Deployment rolled back."
    fi

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
    [[ -n ${old_current} ]] || fail "There is no active release."

    if [[ -n ${requested} ]]; then
        validate_release_id "${requested}"
        target="${RELEASES_DIR}/${requested}"
    else
        target="${old_previous}"
    fi
    [[ -n ${target} && -d ${target} ]] || fail "Rollback release is unavailable."
    [[ ${target} != "${old_current}" ]] || fail "Requested release is already active."
    release_id="$(basename "${target}")"
    validate_release "${target}" "${release_id}"

    nginx_check
    atomic_link "${old_current}" "${PREVIOUS_LINK}"
    atomic_link "${target}" "${CURRENT_LINK}"
    if ! nginx_check || ! public_health "${release_id}"; then
        log "Rollback verification failed; restoring original symlinks."
        restore_links "${old_current}" "${old_previous}"
        nginx_check
        fail "Rollback was not applied."
    fi
    log "Rollback successful: ${release_id}"
}

show_status() {
    printf 'current=%s\n' "$(link_target "${CURRENT_LINK}")"
    printf 'previous=%s\n' "$(link_target "${PREVIOUS_LINK}")"
    if [[ -d ${RELEASES_DIR} ]]; then
        find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
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
        cp \
        flock \
        find \
        sort \
        readlink \
        install \
        mv \
        ln \
        systemctl \
        journalctl \
        seq \
        mktemp \
        awk \
        grep \
        head \
        tail \
        cut; do

        command -v "${command_name}" >/dev/null || \
            fail "Required command is missing: ${command_name}"
    done

    exec 9>"${LOCK_FILE}"
    flock -n 9 || fail "Another Frontend deployment is running."

    case "${action}" in
        deploy)
            [[ $# -eq 2 ]] || { usage; exit 2; }
            deploy_release "$1" "$2"
            ;;
        rollback)
            [[ $# -le 1 ]] || { usage; exit 2; }
            rollback_release "${1:-}"
            ;;
        status)
            [[ $# -eq 0 ]] || { usage; exit 2; }
            show_status
            ;;
        *)
            usage
            exit 2
            ;;
    esac
}

main "$@"
