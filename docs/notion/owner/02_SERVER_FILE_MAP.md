# ODY 서버와 Repository 파일 지도

## 운영 서버

| Node | Path/Resource | 역할 | Repository 관계 |
|---|---|---|---|
| both | `/opt/hadoop/etc/hadoop`, `/etc/systemd/system` | HDFS/YARN 설정과 boot recovery | 서버 운영 상태, Git 재설치 없음 |
| master | `/opt/spark/conf` | Spark on YARN client | 서버 운영 상태 |
| app | `/etc/nginx/sites-available/backend` | HTTPS와 active Blue-Green upstream | `deploy.sh`가 port만 전환 |
| master | Jenkins workspace / webhook Nginx | CI/CD | `Jenkinsfile` |
| app | `/home/ubuntu/S15P21A405/deploy.sh` | Blue-Green 배포 | 루트 `deploy.sh` |
| app | `/etc/ody/backend.env` | Backend DB environment | Git 저장 금지 |
| app | `/etc/ody/postgres.env`, `neo4j.env` | DB credential | Git 저장 금지 |
| master | `/etc/ody/monitoring.env` | Grafana credential | Git 저장 금지 |
| app | `ody-postgres-data`, `ody-neo4j-data` | persistent data | Git 외부, 삭제 금지 |
| both | `/var/backups/ody-infra` | backup/performance artifacts | Git 외부 |
| both | `/etc/letsencrypt` | certificate/private key | Git 저장 금지 |

## Repository

| Path | 지속 용도 |
|---|---|
| `Jenkinsfile`, `deploy.sh`, `backend/Dockerfile` | CI/CD와 배포 |
| `infra/local`, `.env.local.example` | 로컬 PostgreSQL/Neo4j |
| `infra/k6` | 성능 회귀 시나리오 |
| `ops/backup`, `ops/restore` | 운영 DB backup/restore drill |
| `ops/verify` | 읽기 전용 runtime health |
| `ops/performance` | k6 orchestration/artifact |
| `observability/dashboards` | Grafana dashboard reference |
| `scripts/verify.py` | local/infra/server 통합 검증 |

서버 config를 변경할 때는 Repository에 제거된 과거 provisioning 경로가 있다고 가정하지 않는다.
