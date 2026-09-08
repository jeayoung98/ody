# Infrastructure Status

- 기준일: 2026-09-07
- 이 문서는 사용자가 확인한 운영 상태를 기록한다.
- 이번 Repository 정리 작업에서는 서버에 접속하거나 운영 구성을 변경하지 않았다.

## 운영 상태

| Component | master-node | app-node | 상태 |
|---|---|---|---|
| HDFS/YARN | NN/DN/SNN, RM/NM | DN/NM | 2 DataNodes, 2 RUNNING NodeManagers, FSCK HEALTHY |
| Spark | 4.2.0 client, Spark on YARN | YARN executor | VERIFIED |
| CI/CD | Jenkins, webhook Nginx | Blue-Green runtime | VERIFIED |
| Backend | - | HTTPS Nginx, Blue/Green, DB profile | HEALTHY |
| PostgreSQL | - | Source of Truth | persistence/backup/restore VERIFIED |
| Neo4j | - | graph projection | persistence/backup/restore VERIFIED |
| Monitoring | Prometheus, Grafana, Node Exporter | Node Exporter | targets/dashboard VERIFIED |
| TLS | webhook HTTPS | Backend HTTPS | Certbot renew dry-run VERIFIED |
| Recovery | control plane/monitoring | worker/backend/DB | sequential reboot VERIFIED |
| Frontend CI/CD | separate Jenkinsfile prepared | static release deploy prepared | SERVER ROLLOUT PENDING |

## Repository 역할

Repository는 서버 최초 provisioning 원본을 더 이상 보관하지 않는다. 계속 사용하는 항목만 유지한다.

- CI/CD: `Jenkinsfile`, `deploy.sh`, `backend/Dockerfile`
- Frontend CI/CD: `Jenkinsfile.frontend`, `deploy-frontend.sh`, `frontend`
- Local dependencies: `infra/local`, `.env.local.example`, `scripts/local`
- Performance scenarios: `infra/k6`, `ops/performance`
- Runtime operations: `ops/backup`, `ops/restore`, `ops/verify`
- Dashboard reference: `observability/dashboards`
- Backend environment contract: `application*.yml`

Hadoop/Spark/systemd/Nginx/production DB/Monitoring의 실제 설정은 각 서버 경로에 적용 완료된 운영 상태다.
Repository에서 재설치하거나 자동 동기화하지 않는다.

## 남은 제품 개발 결정

- 실제 Entity/schema와 migration 전략
- PostgreSQL→Neo4j projection 동기화/재생성 방식
- off-host backup 보관과 RPO/RTO
- 제품 API 기준 성능 threshold
- 중앙 로그와 알림 채널
