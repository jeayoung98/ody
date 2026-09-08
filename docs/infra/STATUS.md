# Infrastructure Status

- 기준일: 2026-09-08
- 이 문서는 사용자가 확인한 운영 상태를 기록한다.
- Repository 변경과 Frontend 정적 배포/Nginx routing을 실제 서버에서 검증했다.

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
| Backend Pipeline path | 작업 브랜치와 `backend/Jenkinsfile`로 전환 | `backend/deploy.sh` 배치 | BUILD VALIDATION IN PROGRESS |
| Frontend CI/CD | `frontend/Jenkinsfile` prepared | release `manual-e5bce3e`, Nginx static routing | STATIC ROLLOUT VERIFIED, JOB PENDING |

## Repository 역할

Repository는 서버 최초 provisioning 원본을 더 이상 보관하지 않는다. 계속 사용하는 항목만 유지한다.

- Backend CI/CD: `backend/Jenkinsfile`, `backend/deploy.sh`, `backend/Dockerfile`
- Frontend CI/CD: `frontend/Jenkinsfile`, `frontend/deploy.sh`
- Local dependencies: `infra/local`, `.env.local.example`, `scripts/local`
- Performance scenarios: `infra/k6`, `ops/performance`
- Runtime operations: `ops/backup`, `ops/restore`, `ops/verify`
- Dashboard reference: `observability/dashboards`
- Backend environment contract: `application*.yml`

Backend Jenkins job은 작업 브랜치와 `backend/Jenkinsfile`을 사용하도록 전환했으며 실제 build를
재검증한다. app-node에는 `backend/deploy.sh`와 `frontend/deploy.sh`를 배치했다. Frontend 정적 release와
Nginx SPA/API routing은 검증됐고, 별도 Frontend Jenkins job 및 GitLab webhook 연결이 남아 있다.

Hadoop/Spark/systemd/Nginx/production DB/Monitoring의 실제 설정은 각 서버 경로에 적용 완료된 운영 상태다.
Repository에서 재설치하거나 자동 동기화하지 않는다.

## 남은 제품 개발 결정

- 실제 Entity/schema와 migration 전략
- PostgreSQL→Neo4j projection 동기화/재생성 방식
- off-host backup 보관과 RPO/RTO
- 제품 API 기준 성능 threshold
- 중앙 로그와 알림 채널
