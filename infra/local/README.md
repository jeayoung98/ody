# Local dependencies

PostgreSQL, Redis, Neo4j를 loopback port로 실행하는 개발 전용 Compose다. 운영 `/etc/ody`나
production container/volume/network를 참조하지 않는다.

```text
python scripts/local/dev.py init
python scripts/local/dev.py up
python scripts/local/dev.py status
python scripts/local/dev.py backend
python scripts/local/dev.py down
```

`init`은 개발 전용 credential이 담긴 `.env.local.example`을 `.env.local`로 복사한다. 기존 파일은
덮어쓰지 않는다. `down`은 container와 Compose network만 제거하고 named volume은 보존한다.

```bash
python scripts/local/dev.py reset
```

`reset`만 세 데이터 volume을 제거하며, interactive terminal에서 `DELETE LOCAL DATA`를 정확히
입력해야 실행된다. 자동화나 기본 개발 흐름에서 실행하지 않는다.

| Service | Image | Local endpoint |
| --- | --- | --- |
| PostgreSQL | `postgres:17.11-bookworm` | `127.0.0.1:5432` |
| Redis | `redis:7.4.11-alpine` | `127.0.0.1:6379` |
| Neo4j Community | `neo4j:5.26.30-community` | `127.0.0.1:7474`, `127.0.0.1:7687` |
