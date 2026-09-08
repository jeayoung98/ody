# Infrastructure Security

## 경계

외부 공개는 app HTTPS와 master webhook HTTPS다. HTTP는 HTTPS redirect에만 사용한다. Jenkins 8080,
Backend 8081/8082, Prometheus 9090, Grafana 3000은 loopback이다.
Node Exporter 9100은 private IP에만 bind한다. PostgreSQL 5432와 Neo4j Bolt 7687은 host port가 없고
app의 user-defined `ody-internal` Docker network에서만 접근한다. Hadoop/YARN 관리 포트도 외부 비공개다.

master Nginx는 exact webhook path만 Jenkins로 proxy하고 나머지는 404다. app의 actuator health/metrics는
localhost와 master private IP만 허용한다. 방화벽/보안 그룹은 Repository 스크립트가 자동 변경하지 않는다.

## Secret

PEM/SSH private key, GitLab/Jenkins credential, DB/Neo4j/Grafana password, TLS private key를 Repository,
로그, 명령 인자에 저장하지 않는다. 실제 값은 서버 `/etc/ody/*.env`에만 둔다.

| 파일 | 권한 | 소비자 |
|---|---|---|
| `/etc/ody/postgres.env` | root 0600 | PostgreSQL Compose/backup scripts |
| `/etc/ody/neo4j.env` | root 0600 | Neo4j Compose/backup scripts |
| `/etc/ody/backend.env` | root:ubuntu 0640 | `backend/deploy.sh`의 Backend container |
| `/etc/ody/monitoring.env` | root 0600 | master monitoring Compose |

운영 secret은 서버에서만 관리하며 Repository 도구는 생성·회전·출력하지 않는다.
`.env.local.example`에는 local 개발 변수 이름과 placeholder만 둔다.

Frontend의 `VITE_*` 변수는 build 결과에 포함되는 공개 설정이다. `/api` 같은 public routing 값만 사용하고
DB password, JWT/OAuth secret, private API key, PostgreSQL/Neo4j credential을 넣지 않는다. Frontend artifact는
실행 권한이나 server credential 없이 정적 파일만 포함한다.

## 권한과 제한

- Hadoop/YARN daemon: `ubuntu`; Jenkins runtime: `jenkins`; Backend image user: 비-root `spring`
- PostgreSQL runtime role: NOSUPERUSER/NOCREATEDB/NOCREATEROLE
- Neo4j Community 계정은 세밀한 RBAC 한계가 있어 private network로 보완
- 운영 runtime verify와 DB backup/restore: 명시적 sudo
- 컨테이너 CPU/memory limit, no privileged, 필요한 Node Exporter host mount만 read-only

`chmod -R 777`, broad host mount, public DB bind, secret 출력, 운영 DB overwrite restore를 금지한다.

## TLS와 점검

app/master 인증서와 Certbot은 서버에서 운영하며 renew dry-run 검증이 완료됐다. 인증서 key 내용은
Git에 넣지 않고 Repository에서 재설치하지 않는다.

```bash
git grep -nEi '(BEGIN .*PRIVATE KEY|password[[:space:]]*=|access[_-]?token[[:space:]]*=)'
ss -lntp
docker inspect ody-postgres ody-neo4j --format '{{json .HostConfig.PortBindings}}'
```
