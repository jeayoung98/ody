# Local Development

로컬 개발은 운영 provisioning과 분리된 `infra/local/docker-compose.yml` 하나를 사용한다.
PostgreSQL, Redis, Neo4j port는 localhost에만 bind하며 local 전용 named volume을 사용한다.

```bash
python scripts/local/dev.py init
python scripts/local/dev.py check
python scripts/local/dev.py up
python scripts/local/dev.py status
python scripts/local/dev.py backend
python scripts/local/dev.py down
```

`.env.local`은 Git/Docker build context에서 제외되며 운영 `/etc/ody/*.env` 파일을 참조하지 않는다.
커밋된 example의 값은 로컬 개발 전용이고 운영에서 재사용하면 안 된다. `down`은 named volume을
삭제하지 않는다. 데이터 초기화가 꼭 필요할 때만 interactive `reset`을 실행한다.

기본 Spring profile은 DB가 없는 `standalone`이다. `local` profile은 `db` profile을 함께 활성화해
PostgreSQL과 Neo4j에 연결하고 Redis 접속 속성을 로드한다. 현재 Backend에 Redis 사용 코드와
Spring Data Redis dependency는 없으므로 Redis 자체 health는 Compose의 `redis-cli ping`으로 확인한다.

IntelliJ에서는 Spring Boot Run Configuration의 active profiles에 `local`을 입력한다. 해당 입력란이
없으면 Environment variables에 `SPRING_PROFILES_ACTIVE=local`을 추가한다. 나머지 datasource,
Redis, Neo4j 환경변수는 `.env.local`과 같은 값으로 등록한다.

## Frontend

Node `24.20.0`과 npm `11.19.0`을 사용한다. Backend가 port 8080에서 실행 중일 때 다음 명령으로 시작한다.

```bash
cd frontend
nvm use
npm ci
npm run dev
```

Vite는 `/api`를 `http://localhost:8080`으로 proxy한다. 운영 hostname은 source에 hard-code하지 않으며
local/production 모두 `VITE_API_BASE_URL=/api`를 사용한다.

Repository 전체 점검:

```bash
./gradlew test build
python scripts/verify.py --local --infra
```
