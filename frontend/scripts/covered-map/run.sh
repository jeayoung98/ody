#!/usr/bin/env bash
# 가려진 지도 멈춤 비포·애프터 비용을 기준 측정으로 묶어 잰다 (S15P21A405-737)
#   bash scripts/covered-map/run.sh        (frontend 폴더에서)
# 기준 측정(비포 빌드 지도 한 프레임, 폰·감속 없음) → CPU×4 비교 → 기준 측정 → 감속 없음 비교 → 기준 측정.
# 기준 측정이 15% 넘게 흔들리면 그 사이 비교는 버린다. 충전기를 꽂고 잰다 — 배터리로 오래 돌리면 PC 가 2배까지 느려진다.
cd "$(dirname "$0")/../.."
power() { powershell -NoProfile -Command '$a=(Get-CimInstance -Namespace root\wmi -ClassName BatteryStatus | Select-Object -First 1 PowerOnline); "전원 연결=" + $a.PowerOnline' 2>/dev/null; }
calib() {
  ORIGIN=http://localhost:3001 COVER_CPU=1 node scripts/baseline-bench.mjs cover 1 > "$1" 2>&1
  node -e 'const t=require("fs").readFileSync(process.argv[1],"utf8");console.log("기준 측정(지도 한 프레임, 비포 빌드):",JSON.parse(t.slice(t.indexOf("{"))).summary.map.frameMsMed,"ms")' "$1"
}
OUT=${OUT:-$(node -e 'console.log(require("os").tmpdir())')/ody-covered-map}
mkdir -p "$OUT"
power
calib "$OUT/calib-1.json"
node scripts/covered-map/bench.mjs 3 4
calib "$OUT/calib-2.json"
node scripts/covered-map/bench.mjs 3 1
calib "$OUT/calib-3.json"
power
