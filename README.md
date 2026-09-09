# ODY

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
cd backend
./gradlew test build
cd ..
python scripts/verify.py --local --infra
```

## Repository map

루트 디렉터리는 다음 책임에 따라 분리한다.

| Directory | 역할 | 유지 이유 |
| --- | --- | --- |
| `backend/` | Spring Boot, Gradle, Dockerfile, Jenkinsfile, 배포 스크립트 | 독립적으로 빌드·테스트·배포하는 Backend 프로젝트 |
| `frontend/` | React, TypeScript, Vite, Jenkinsfile, 배포 스크립트 | 독립적으로 빌드·테스트·배포하는 Frontend 프로젝트 |
| `infra/` | 로컬 Compose와 k6 시나리오 | 개발 의존 서비스 및 인프라 성능 검증 구성 |
| `ops/` | 서버 점검, DB backup/restore, 성능 실행 도구 | 구축된 운영 환경에서 반복 실행하는 runbook 도구 |
| `observability/` | Grafana dashboard source | Dashboard 변경 이력을 Git에서 관리하기 위한 기준 파일 |
| `scripts/` | 로컬 환경 진입점과 저장소 통합 검증 | `dev.py`, `verify.py`처럼 여러 영역을 함께 다루는 공통 명령 |
| `docs/` | 인프라 설계, 운영 절차, 팀/담당자 문서 | 실제 구성의 상태와 검증·복구 절차를 공유하는 문서 원본 |
| `.git/` | Git 내부 metadata | 로컬 clone에만 존재하며 직접 수정하지 않는 저장소 관리 영역 |

AI/Data 트랙 코드는 `data/` 에 있다. 규칙은 `data/AGENTS.md` 를 따른다.

루트 파일은 저장소 전체에 적용되는 항목만 둔다.

| File | 역할 |
| --- | --- |
| `README.md`, `AGENTS.md` | 저장소 안내와 인프라 작업 규칙 |
| `.gitignore`, `.gitattributes` | 저장소 전체 Git 규칙 |
| `.env.local.example` | Backend와 세 로컬 데이터 서비스가 함께 사용하는 개발 환경변수 예시 |
| `.env.local` | Git에서 제외되는 개인별 로컬 개발값 |

Gradle/npm이 생성하는 `.gradle/`, `build/`, `node_modules/`, `dist/`는 각 프로젝트 내부의 Git 제외
산출물이다. 저장소 루트에는 두지 않는다.

운영 secret과 서버 configuration은 Git에 저장하지 않는다. 운영 상태와 runbook은
`docs/infra/STATUS.md`, `docs/infra/RUNBOOKS.md`를 따른다.
