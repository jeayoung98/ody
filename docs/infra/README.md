# ODY Infrastructure Documentation

ODY 인프라 Source of Truth의 진입점이다. 계획과 실제 상태를 구분한다.

| 문서 | 목적 |
|---|---|
| `STATUS.md` | 실제 운영 상태와 Repository 책임 범위 |
| `ARCHITECTURE.md` | 2-node 전체 구조, network와 flow |
| `DEPLOYMENT.md` | Backend Blue-Green 배포와 rollback |
| `examples/frontend-nginx.locations.conf` | 기존 HTTPS server block에 반영할 Frontend static routing reference |
| `CI_CD.md` | Jenkins/GitLab webhook Pipeline |
| `OBSERVABILITY.md` | Prometheus/Grafana/Node Exporter/Micrometer |
| `PERFORMANCE.md` | k6 측정과 비교 원칙 |
| `SPARK_PIPELINE.md` | Spark on YARN topology와 데이터 처리 |
| `DATABASE.md` | PostgreSQL/Neo4j 역할, persistence, backup/restore |
| `SECURITY.md` | 공개 경계, secret과 권한 |
| `INCIDENT_RESPONSE.md` | 증상별 장애 대응 |
| `RUNBOOKS.md` | 반복 검증/backup/restore/rollback 절차 |
| `LOCAL_ENV.md` | 현재 Backend 로컬 실행 |
| `ADR_TEMPLATE.md` | 중요한 결정 기록 템플릿 |
| `CODEX_WORKFLOWS.md` | 개발/운영 작업 계약 |

반복 운영 스크립트는 `ops/`, local dependency와 k6는 `infra/`, Notion 복사용 문서는
`docs/notion/`에 있다. 실제 서버 configuration은 Repository의 관리 대상이 아니다.

새 결정을 내릴 때:

1. `STATUS.md` 상태를 갱신한다.
2. 지속 운영 도구가 바뀌면 `ops/`와 validation/rollback을 함께 변경한다.
3. 운영 절차가 바뀌면 기술 문서와 관련 Notion 문서를 함께 갱신한다.
4. 실제 서버 적용 전에는 `RUNNING`으로 표시하지 않는다.
