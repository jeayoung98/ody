# k6 Performance Tests

k6 시나리오는 smoke/baseline/load/Blue-Green zero-downtime 검증에 사용하며 실제 운영 baseline 실행이
완료됐다. 수치는 `docs/infra/STATUS.md`를 참고한다.

## 시나리오

| Script | 목적 |
|---|---|
| `smoke.js` | API와 시나리오가 정상인지 낮은 부하로 확인 |
| `baseline.js` | 변경 전후 비교를 위한 짧은 기준 부하 |
| `load.js` | p50/p95/p99, error rate, request rate와 자원 사용 비교 |
| `zero-downtime.js` | 요청을 지속한 채 Jenkins Blue-Green 배포를 별도로 실행하고 실패/latency 변화 확인 |
| `frontend-zero-downtime.js` | Frontend root, hashed asset, build marker, Backend API를 배포 중 지속 확인 |

## 실행 순서

반드시 smoke부터 실행한다.

```bash
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/smoke.js
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/load.js
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/frontend-zero-downtime.js
```

표준 실행은 master-node의 운영 runner를 사용한다.

```bash
sudo bash ops/performance/run.sh smoke
sudo bash ops/performance/run.sh baseline
sudo bash ops/performance/run.sh load
sudo bash ops/performance/run.sh zero-downtime backend:<tested-tag>
```

결과에는 commit, image tag, 시작/종료 시각, VU/arrival rate, request count, throughput,
p50/p95/p99, error rate를 기록한다. 같은 시간대 Grafana에서 CPU, memory, JVM heap/GC,
HTTP rate/latency/error를 함께 확인한다. Jenkins credential이나 token은 스크립트에 넣지 않는다.
