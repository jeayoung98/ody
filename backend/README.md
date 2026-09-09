# ODY Backend

Java 17과 Spring Boot 4.1 기반 Backend 애플리케이션이다. 저장소 루트의 인프라·문서 및
`frontend/`와 분리된 독립 Gradle 프로젝트다.

```bash
./gradlew test
./gradlew build
```

저장소 루트에서 local dependencies와 함께 실행할 때는 단일 개발 진입점을 사용한다.

```bash
python scripts/local/dev.py init
python scripts/local/dev.py up
python scripts/local/dev.py backend
```

기본 profile은 외부 DB가 필요 없는 `standalone`이며, `local` profile은 PostgreSQL과 Neo4j를 사용하는
`db` profile을 함께 활성화한다.
