#!/usr/bin/env bash

set -euo pipefail
# Runtime HDFS/YARN health verification for the fixed two-node cluster.

if [[ "${ODY_VERIFY_FIXTURE:-0}" == 1 ]]; then
    readonly HOST="${ODY_VERIFY_HOST:?Fixture host is required}"
else
    readonly HOST="$(hostname -s)"
fi
readonly HADOOP_HOME="${HADOOP_HOME:-/opt/hadoop}"
readonly JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"

case "${HOST}" in
    master-node|app-node) ;;
    *) echo "ERROR: Expected master-node or app-node, got ${HOST}." >&2; exit 1 ;;
esac

export HADOOP_HOME JAVA_HOME
export HADOOP_CONF_DIR="${HADOOP_CONF_DIR:-${HADOOP_HOME}/etc/hadoop}"
export PATH="${JAVA_HOME}/bin:${HADOOP_HOME}/bin:${HADOOP_HOME}/sbin:${PATH}"

for command_name in jps hdfs yarn; do
    command -v "${command_name}" >/dev/null 2>&1 || {
        echo "ERROR: Required command is missing: ${command_name}" >&2
        exit 1
    }
done

echo "== JVM processes on ${HOST} =="
jps_output="$(jps)"
printf '%s\n' "${jps_output}"

if [[ "${HOST}" == "master-node" ]]; then
    for process_name in NameNode DataNode SecondaryNameNode ResourceManager NodeManager; do
        grep -Eq "(^|[[:space:]])${process_name}$" <<<"${jps_output}" || {
            echo "ERROR: ${process_name} is not present on master-node." >&2
            exit 1
        }
    done
else
    for process_name in DataNode NodeManager; do
        grep -Eq "(^|[[:space:]])${process_name}$" <<<"${jps_output}" || {
            echo "ERROR: ${process_name} is not present on app-node." >&2
            exit 1
        }
    done
fi

echo "== HDFS report =="
deadline=$((SECONDS + 90))
while true; do
    remaining=$((deadline - SECONDS))
    (( remaining > 0 )) || { echo 'ERROR: HDFS RPC readiness timeout (90s)'; exit 1; }
    if hdfs_report="$(timeout "${remaining}s" hdfs dfsadmin -report 2>&1)"; then break; fi
    (( SECONDS + 5 < deadline )) || { printf '%s\n' "$hdfs_report"; exit 1; }
    sleep 5
done
printf '%s\n' "${hdfs_report}"
grep -Fq 'Live datanodes (2)' <<<"${hdfs_report}" || {
    echo "ERROR: HDFS does not report exactly 2 live DataNodes." >&2
    exit 1
}

echo "== HDFS fsck =="
fsck_output="$(timeout 90s hdfs fsck /)"
printf '%s\n' "${fsck_output}"
grep -Fq "The filesystem under path '/' is HEALTHY" <<<"${fsck_output}" || {
    echo "ERROR: HDFS fsck is not HEALTHY." >&2
    exit 1
}

echo "== YARN nodes =="
for metric in 'Missing blocks|Number of missing blocks' 'Corrupt blocks|Blocks with corrupt replicas|Number of corrupt blocks' 'Under[- ]replicated blocks|Low redundancy blocks'; do
    values="$(printf '%s\n%s\n' "$hdfs_report" "$fsck_output" | grep -Ei "($metric)[[:space:]]*:[[:space:]]*[0-9]+" || true)"
    [[ -n "$values" ]] || { echo "ERROR: Missing HDFS counter: $metric"; exit 1; }
    if printf '%s\n' "$values" | grep -Eq ':[[:space:]]*[1-9][0-9]*'; then
        echo "ERROR: Nonzero HDFS counter: $metric"; exit 1
    fi
done
yarn_output="$(timeout 30s yarn node -list -all)"
printf '%s\n' "${yarn_output}"
# Historical SHUTDOWN rows do not count as live capacity.
for node in master-node app-node; do
    count="$(awk -v node="$node" '$2 == "RUNNING" {split($1,a,":"); if(a[1]==node) n++} END {print n+0}' <<<"$yarn_output")"
    [[ "$count" == 1 ]] || { echo "ERROR: Expected exactly one RUNNING $node"; exit 1; }
done

running_nodes="$(grep -c '[[:space:]]RUNNING[[:space:]]' <<<"${yarn_output}" || true)"
if [[ "${running_nodes}" -ne 2 ]]; then
    echo "ERROR: Expected 2 RUNNING NodeManagers, got ${running_nodes}." >&2
    exit 1
fi

echo "Hadoop/YARN cluster verification passed on ${HOST}."
