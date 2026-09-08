# Runtime operations

이 디렉터리는 이미 구축된 ODY 운영 환경에서 반복 사용하는 도구만 포함한다.

- `backup/`, `restore/`: PostgreSQL/Neo4j backup과 격리 restore drill
- `verify/`: Backend, DB, HDFS/YARN, CI/CD, Monitoring 읽기 전용 점검
- `performance/`: k6 실행과 결과 artifact 수집
- `tests/`: runtime verification regression fixture

서버 provisioning, secret 생성, Docker volume 삭제, HDFS format 기능은 포함하지 않는다. 명령과 안전
조건은 `docs/infra/RUNBOOKS.md`를 따른다.
