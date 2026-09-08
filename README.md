# ODY Backend

Spring Boot 4.1.1 / Java 17 기반 ODY Backend다. PostgreSQL을 transactional Source of Truth로,
Neo4j를 graph projection으로 사용하며 Redis를 로컬 개발 의존 서비스로 함께 제공한다. Jenkins는
Docker Blue-Green 방식으로 app-node에 배포한다.

Frontend는 `frontend/`의 React/TypeScript/Vite SPA다. 운영에서는 별도 application container 없이
app-node host Nginx가 `/var/www/ody/current`의 정적 artifact를 제공한다.

## Local development

```bash
python scripts/local/dev.py init
python scripts/local/dev.py up
python scripts/local/dev.py backend
```

`init`은 Git에서 제외된 `.env.local`을 개발 전용 기본값으로 한 번만 생성하며 기존 파일은 덮어쓰지
않는다. `up`은 PostgreSQL 17.11, Redis 7.4.11, Neo4j 5.26.30 Community를 시작하고 세 서비스의
health를 확인한다.

```bash
python scripts/local/dev.py status
python scripts/local/dev.py down    # named volume 보존
python scripts/local/dev.py reset   # 대화형 확인 후에만 named volume 삭제
```

DB 없이 API/test만 실행할 때는 기본 `standalone` profile을 사용한다.

Frontend local server는 `/api`를 Backend `localhost:8080`으로 proxy한다.

```bash
cd frontend
nvm use
npm ci
npm run dev
```

### IntelliJ

먼저 `init`, `up`을 실행한다. Spring Boot Run Configuration에서 active profile을 `local`로 지정하고,
Environment variables에 `.env.local`의 `SPRING_DATASOURCE_*`, `SPRING_DATA_REDIS_*`, `NEO4J_*`
값을 등록한다. active profile 입력란이 없다면 `SPRING_PROFILES_ACTIVE=local`을 환경변수에 추가한다.
터미널에서 `python scripts/local/dev.py backend`를 실행하면 이 설정을 자동으로 적용할 수 있다.

```bash
./gradlew test build
python scripts/verify.py --local --infra
```

## Repository map

- `Jenkinsfile`, `Dockerfile`, `deploy.sh`: CI/CD와 Blue-Green
- `Jenkinsfile.frontend`, `deploy-frontend.sh`: Frontend 정적 artifact CI/CD와 symlink rollback
- `frontend`: React/TypeScript/Vite SPA
- `infra/local`: local PostgreSQL/Redis/Neo4j
- `infra/k6`: 성능 회귀 시나리오
- `ops`: runtime verify, backup/restore, performance runner
- `observability/dashboards`: Grafana dashboard reference
- `docs/infra`: 현재 architecture와 운영 문서

운영 secret과 서버 configuration은 Git에 저장하지 않는다. 운영 상태와 runbook은
`docs/infra/STATUS.md`, `docs/infra/RUNBOOKS.md`를 따른다.
