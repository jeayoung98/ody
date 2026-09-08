# ODY Infrastructure Agent Guide

이 파일은 Codex가 ODY 저장소의 인프라 관련 작업을 수행할 때 따라야 하는 최상위 가이드다.
상세 규칙은 `docs/infra/` 문서를 따른다. 이 파일을 인프라 백과사전으로 확장하지 않는다.

## 1. 범위

이 Repository의 인프라 관련 작업은 서비스 개발에 지속적으로 필요한 범위만 포함한다.

- 애플리케이션 실행 환경
- Docker / Docker Compose
- Reverse Proxy / TLS
- 배포
- CI/CD
- PostgreSQL / Neo4j 운영
- 관측성(Actuator, Micrometer, Prometheus, Grafana)
- 로그
- k6 성능 테스트
- 장애 대응 및 롤백
- Spark 기반 대용량 배치 처리 인프라
- 시크릿과 운영 권한

Hadoop/Spark/systemd/Nginx/production DB/Monitoring의 최초 provisioning 파일은 관리하지 않는다.
운영 서버 configuration 변경은 명시적 요청 없이 Repository에서 재구성하지 않는다.

비즈니스 기능, 화면, 추천 알고리즘 자체의 변경은 인프라 작업 범위가 아니다.

## 2. 먼저 읽을 문서

인프라 관련 작업을 시작하기 전에 작업 종류에 맞는 문서를 확인한다.

1. `docs/infra/STATUS.md`
2. `docs/infra/ARCHITECTURE.md`
3. 작업별 문서
   - 로컬 환경: `LOCAL_ENV.md`
   - 배포: `DEPLOYMENT.md`
   - CI/CD: `CI_CD.md`
   - 관측성: `OBSERVABILITY.md`
   - 성능: `PERFORMANCE.md`
   - DB: `DATABASE.md`
   - Spark: `SPARK_PIPELINE.md`
   - 보안: `SECURITY.md`
   - 장애 대응: `INCIDENT_RESPONSE.md`
   - 반복 운영: `RUNBOOKS.md`

서로 충돌하는 내용이 있으면 `STATUS.md`의 최신 결정사항을 우선한다.

## 3. 현재 확정된 핵심 기술

확정:
- Backend: Spring Boot
- Database: PostgreSQL (Source of Truth), Neo4j (graph projection)
- Performance test: k6
- 대용량 음악 데이터 처리: Spark
- PC Layer: 16단계

아직 확정되지 않은 항목은 `STATUS.md`에 명시한다.
미확정 항목을 확정된 것처럼 구현하지 않는다.

## 4. 변경 원칙

인프라 변경 시 다음 원칙을 따른다.

- 기존 파일과 실행 상태를 먼저 확인한다.
- 변경 전 현재 동작을 재현한다.
- 최소 변경으로 해결한다.
- destructive command를 기본값으로 사용하지 않는다.
- 시크릿을 코드, 로그, 문서, 커밋에 남기지 않는다.
- 운영 데이터 삭제, DB 초기화, 볼륨 삭제, 방화벽 전체 개방은 자동으로 실행하지 않는다.
- 운영 변경은 검증 방법과 롤백 방법을 함께 만든다.
- 같은 설정을 수동으로 반복해야 한다면 코드나 스크립트로 재현 가능하게 만든다.
- 임시 수정은 최종 상태로 두지 않는다.

## 5. 작업 시작 시 확인

가능하면 다음을 먼저 확인한다.

```bash
git status
git diff
docker compose ps
docker ps
```

관련 파일이 존재하면 먼저 읽는다.

```text
backend/Dockerfile
infra/local/
infra/k6/
ops/
observability/
.github/workflows/
scripts/
.env.local.example
```

파일명이나 구조가 다르면 실제 저장소 구조를 따른다.

## 6. 검증 기준

변경 후 가능한 범위에서 관련 검증을 수행한다.

### Backend
```bash
cd backend
./gradlew test
./gradlew build
cd ..
```

### Docker
```bash
docker compose config
docker compose ps
```

### Health
```bash
curl -f http://localhost:<port>/actuator/health
```

### Prometheus
- target이 UP인지 확인
- `/actuator/prometheus` 수집 여부 확인

### Nginx
```bash
nginx -t
```

### k6
- smoke test를 먼저 수행
- 이후 부하 테스트 수행

### Spark
- 작은 샘플 데이터로 먼저 실행
- row count / output schema / 실패 레코드 확인
- 전체 처리 전 파티션 수와 메모리 설정 확인

검증할 수 없는 항목은 성공했다고 단정하지 않는다.

## 7. 완료 조건

인프라 작업은 다음 조건을 충족해야 완료로 간주한다.

- 변경 이유가 명확하다.
- 구성 파일이 재현 가능하다.
- 필요한 검증을 수행했다.
- 실패 시 롤백 방법이 있다.
- 시크릿이 노출되지 않았다.
- 관측 가능한 변경이면 확인할 metric/log가 정의되어 있다.
- 운영 절차가 바뀌면 관련 `docs/infra/` 문서도 갱신했다.

## 8. 금지

명시적 요청 또는 충분한 안전장치 없이 다음 작업을 하지 않는다.

```text
docker system prune -a
docker volume prune
docker compose down -v
DROP DATABASE
DROP TABLE
TRUNCATE
rm -rf /
chmod -R 777
ufw disable
방화벽 전체 포트 개방
운영 시크릿 출력
운영 DB 초기화
```

## 9. 결과 보고 형식

인프라 작업을 완료한 뒤 아래를 짧게 보고한다.

```text
변경:
- ...

검증:
- ...

남은 위험:
- ...

롤백:
- ...
```
