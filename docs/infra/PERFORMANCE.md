# Performance / Blue-Green verification

현재 실제 API는 /api/hello뿐이다. 본 테스트는 proxy/JVM/배포 경로의 infrastructure baseline이며
User/Track/DB business workload 성능을 입증하지 않는다. 대표 domain API가 생기면 API_PATH/scenario를 교체한다.

master-node에서 Monitoring live data 검증을 통과한 뒤:

```bash
sudo bash ops/performance/run.sh smoke
sudo bash ops/performance/run.sh baseline
sudo bash ops/performance/run.sh load
sudo bash ops/performance/run.sh zero-downtime backend:<tested-tag>
```

runner는 k6 2.2.0을 고정하고 private app URL을 기본으로 사용한다. API_PATH/BASE_URL은 환경변수다.
smoke(1 VU/15s), baseline(2 VU/30s), load(10->30 VU/11m), zero-downtime(10 req/s/60s).
zero-downtime은 Jenkins 사용자 기존 SSH key로 `backend/deploy.sh`를 호출한다. k6에는 credential을 전달하지 않는다.
배포 전후 upstream 포트 변경을 검사하고 image ID, container state와 로그를 기록한다.
failed requests=0, checks=100%, dropped iterations=0를 무중단 합격 기준으로 사용한다.

각 결과는 /var/backups/ody-infra/performance/<timestamp>-<scenario>/summary.json와 k6.log에 남는다.
zero-downtime은 before.txt, deploy.log, after.txt도 남는다.
p50/p95/p99(ms), request/s, 실패율, check failure, latency spike를 함께 비교한다.
모든 status check가 200이고 실패율이 0이면 해당 실행 중 관측한 5xx도 0이다.

부하 generator도 master 자원을 쓰므로 실제 운영 동시 Spark/Jenkins 부하와 구분한다.
제품 용량/SLO로 위 baseline 수치를 사용하지 않는다. 성능 측정 수치는 STATUS와 validation report를 참조한다.
