#!/usr/bin/env bash

set -Eeuo pipefail

readonly DEPLOY_ROOT="/var/www/ody"
readonly RELEASES_DIR="${DEPLOY_ROOT}/releases"
readonly CURRENT_LINK="${DEPLOY_ROOT}/current"
readonly PREVIOUS_LINK="${DEPLOY_ROOT}/previous"
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

    for command_name in tar nginx curl flock find sort readlink install mv ln; do
        command -v "${command_name}" >/dev/null || fail "Required command is missing: ${command_name}"
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
