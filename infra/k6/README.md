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
| `constellation-layout.js` | 별자리 배치 API(30곡) 응답·지연 확인 (S15P21A405-265, spec 006 SC-002) |

## 실행 순서

반드시 smoke부터 실행한다.

```bash
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/smoke.js
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/load.js
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/frontend-zero-downtime.js
```

별자리 배치 API는 POST라 따로 돌린다. **존재하는 곡 id여야 한다** — 하나라도 없거나 좌표가 NULL이면
404로 전건 실패한다(부분 배치를 내지 않는 계약이다). 기본값은 `1..30`이고, 404가 나오면 실제 있는 id를 넘긴다.

```bash
BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/constellation-layout.js
MUSIC_IDS=10234,88123,4412 BASE_URL=https://j15a405.p.ssafy.io k6 run infra/k6/constellation-layout.js
```

임계값 `p(95)<1000`은 요구사항 §6의 "유사곡 1초"를 준용한 **잠정 기준**이다. 배치 전용 목표가 팀 문서에
없어 지어내지 않았다. 첫 실측값이 나오면 그 값으로 `specs/006-constellation-layout/spec.md`의 SC-002를
확정 기준으로 바꾸고 임계값도 함께 조인다. 인증이 원복되면(S15P21A405-245) `TOKEN=<accessToken>`을 넘긴다.

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
