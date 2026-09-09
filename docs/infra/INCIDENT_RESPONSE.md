# Incident Response

영향/시작 시각, 직전 변경, proxy/application/database/data-cluster 경계를 먼저 분리한다. 근거 없는 원인은
`추정`으로 기록하며, 사용자 영향 차단과 데이터 손상 방지를 복구보다 앞에 둔다.

## API / 배포

```bash
grep -n 'server 127.0.0.1' /etc/nginx/sites-available/backend
docker ps
curl -f http://127.0.0.1:8081/actuator/health
curl -f http://127.0.0.1:8082/actuator/health
sudo nginx -t
sudo tail -n 200 /var/log/nginx/error.log
```

active upstream/container가 다르면 deploy/Jenkins 로그와 lock을 확인한다. 새 배포를 무조건 실행하지 않는다.
inactive slot 실패는 기존 upstream 보존을 확인하고, 완료 후 회귀는 직전 정상 image tag로 재배포한다.

## PostgreSQL / Neo4j

```bash
sudo bash ops/verify/postgres.sh
sudo bash ops/verify/neo4j.sh
sudo docker logs --tail 200 ody-postgres
sudo docker logs --tail 200 ody-neo4j
sudo docker network inspect ody-internal
```

Backend의 `/actuator/health/dependencies`에서 어느 dependency가 DOWN인지 분리한다. volume을 삭제하거나 운영
DB에 restore를 덮어쓰지 않는다. 손상 의심 시 쓰기 트래픽을 먼저 차단하고, 최신 backup을 별도 DB/volume에
복원하여 consistency를 확인한다. Neo4j offline dump 중단은 trap에 의한 container 재기동 여부를 확인한다.

## HDFS / YARN / Spark

```bash
sudo -u ubuntu bash ops/verify/cluster.sh
hdfs dfsadmin -report
hdfs fsck /
yarn node -list -all
```

stale SHUTDOWN NodeManager record와 현재 RUNNING node를 구분한다. NameNode format, HDFS data 삭제, 전체 동시
restart를 복구 수단으로 사용하지 않는다. Spark 실패는 YARN application/container log, OOM, staging,
schema, partition skew를 확인하고 작은 샘플로 수정 검증한 뒤 전체 재실행한다.

## Monitoring / Webhook

```bash
sudo bash ops/verify/monitoring.sh
curl -f http://127.0.0.1:9090/-/ready
sudo nginx -t
systemctl status jenkins --no-pager
```

target별 private bind/allowlist/exporter/Backend metric을 분리한다. webhook은 exact POST path만 정상이며 외부
`/` 404는 의도된 상태다.

장애 기록에는 시작/탐지/복구 시각, 영향, 로그·metric 근거, 임시 조치, root cause, 영구 수정, rollback과
복원 검증 결과를 남긴다. secret, Authorization header, database URL 원문은 기록하지 않는다.
