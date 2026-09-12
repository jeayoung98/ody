# PostgreSQL / Neo4j Operations

PostgreSQL 17.11은 transactional Source of Truth이고 Neo4j 5.26.30 Community는 graph/read projection이다.
PCA 좌표 원본을 Neo4j로 이전하지 않는다. 현재 Backend에는 domain Entity/schema/migration이 없으므로
Flyway/Liquibase와 projection 동기화 방식은 실제 domain 도입 전에 결정한다.

두 DB는 app-node의 `ody-internal` network에서만 접근한다. PostgreSQL은 `ody-postgres-data`, Neo4j는
`ody-neo4j-data`와 `ody-neo4j-logs` named volume을 사용한다. host port는 publish하지 않는다.

GUI(DBeaver, Neo4j Browser)로 보려면 SSH tunnel이 필요하다. 절차는 `DB_ACCESS.md`.

실제 credential은 app-node의 `/etc/ody/postgres.env`, `neo4j.env`, `backend.env`에만 있다.
Repository에는 운영 credential이나 production Compose를 보관하지 않는다.

## 반복 운영

```bash
sudo bash ops/verify/postgres.sh
sudo bash ops/verify/neo4j.sh

sudo bash ops/backup/postgres.sh
sudo bash ops/restore/postgres.sh /var/backups/ody-infra/postgres/<timestamp>/ody.dump ody_restore_<name>

sudo bash ops/backup/neo4j.sh --offline
sudo bash ops/restore/neo4j.sh /var/backups/ody-infra/neo4j/<timestamp>/neo4j.dump ody-neo4j-restore-<name>
```

PostgreSQL restore는 새 `ody_restore_*` database에만, Neo4j restore는 새
`ody-neo4j-restore-*` volume에만 허용한다. 운영 DB/volume을 덮어쓰거나 자동 삭제하지 않는다.
Neo4j Community dump는 offline이므로 유지보수 시간을 확보하며, 스크립트는 실패 시 container를 다시
시작한다.

backup은 `/var/backups/ody-infra`에 생성되고 자동 retention 삭제는 하지 않는다. 같은 EC2 disk의
backup은 node 손실을 막지 못하므로 off-host 암호화 보관과 RPO/RTO는 별도로 운영해야 한다.
