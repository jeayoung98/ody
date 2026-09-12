# DB GUI 접속 (DBeaver)

운영 PostgreSQL·Neo4j는 app-node의 `ody-internal` Docker network에만 연결되고 host port를 publish하지
않는다. 외부에서 바로 연결할 주소가 없으므로 **SSH 터널**을 거쳐야 한다. 이 문서는 DBeaver 기준 절차다.
CLI 접근과 반복 운영 절차는 `DATABASE.md`에 있다.

Jira **S15P21A405-235**

---

## 0. 준비물

| 항목 | 값 |
|---|---|
| SSH host | `j15a405.p.ssafy.io` |
| SSH user | `ubuntu` |
| SSH key | 팀에서 받은 `J15A405T.pem` |
| PostgreSQL 컨테이너 | `ody-postgres` |
| Neo4j 컨테이너 | `ody-neo4j` |

DB 계정과 비밀번호는 app-node의 `/etc/ody/postgres.env`, `/etc/ody/neo4j.env`에만 있다. 저장소·문서·메신저에
값을 옮기지 않는다. 조회용으로는 애플리케이션 role인 `ody_app`을 쓴다. 값은 다음 명령으로 각자 확인한다.

```bash
ssh -i <키경로> ubuntu@j15a405.p.ssafy.io
sudo cat /etc/ody/postgres.env
```

---

## 1. 컨테이너 IP 확인

터널의 목적지는 컨테이너 IP다. app-node에서:

```bash
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ody-postgres
```

예: `172.18.0.3`.

⚠️ 이 IP는 **컨테이너를 다시 만들면 바뀐다**(재시작만으로는 대개 유지된다). 접속이 갑자기 안 되면 이 명령부터
다시 돌린다. 컨테이너 이름은 host에서 DNS로 풀리지 않으므로 이름 대신 IP를 써야 한다.

---

## 2. DBeaver 연결 만들기

새 연결 → PostgreSQL 선택. 탭 두 개를 채운다.

### Main 탭

| 항목 | 값 |
|---|---|
| Host | 1번에서 확인한 컨테이너 IP (예 `172.18.0.3`) |
| Port | `5432` |
| Database | `/etc/ody/postgres.env`의 `POSTGRES_DB` |
| Username | `ody_app` |
| Password | 같은 파일의 `APP_DB_PASSWORD` |

Host에 `localhost`를 넣지 않는다. 터널 반대편(app-node)에서 본 주소를 적는 자리다.

### SSH 탭

`Use SSH Tunnel` 체크 후:

| 항목 | 값 |
|---|---|
| Host/IP | `j15a405.p.ssafy.io` |
| Port | `22` |
| User Name | `ubuntu` |
| Authentication Method | `Public Key` |
| Private Key | 받은 `.pem` 파일 경로 |

`Test tunnel configuration`으로 터널만 먼저 확인하고, 그다음 `Test Connection`을 누른다.

### 읽기 전용으로 잠그기 (권장)

운영 DB다. 결과 그리드에서 셀을 잘못 고치면 UPDATE가 그대로 나간다.

연결 편집 → **General → Connection type을 `Production`** 으로, **Initialization → `Read-only connection`** 체크.
Production 타입은 탭을 빨간색으로 표시하고 자동 커밋을 막아 준다.

### 수동 터널을 쓰는 경우

DBeaver 내장 SSH 대신 직접 뚫어도 된다. 이때만 Host가 `localhost`다.

```bash
ssh -i <키경로> -N -L 15432:<컨테이너IP>:5432 ubuntu@j15a405.p.ssafy.io
```

DBeaver에서 Host `localhost`, Port `15432`, SSH 탭은 비운다. 로컬 5432는 `infra/local/docker-compose.yml`의
개발용 PostgreSQL이 쓰므로 15432로 피했다.

---

## 3. vector(16) 컬럼 보기

`music.location`은 pgvector의 `vector(16)` 타입이다. DBeaver는 이 타입을 모르므로 그리드에 문자열로 보여준다.
숫자로 다루려면 `real[]`로 캐스팅한다. 배열 인덱스는 **1부터**다.

```sql
-- 좌표 앞 4축만 숫자로
SELECT id, title, artist,
       (location::real[])[1] AS pc1,
       (location::real[])[2] AS pc2,
       (location::real[])[3] AS pc3,
       (location::real[])[4] AS pc4
FROM music
LIMIT 50;
```

16축을 한 번에 세로로 펼치려면:

```sql
SELECT id, dim, val
FROM music, unnest(music.location::real[]) WITH ORDINALITY AS t(val, dim)
WHERE id = 1
ORDER BY dim;
```

---

## 4. 확인용 질의

### 적재 상태 (가볍다)

```sql
SELECT (SELECT count(*) FROM music)                        AS music,
       (SELECT count(*) FROM genre)                        AS genre,
       (SELECT count(*) FROM music_genre)                  AS links,
       (SELECT count(*) FROM music WHERE location IS NULL) AS null_location;
```

기대값 `6624399` / `29` / `71285` / `0`. 장르 링크가 곡 수에 비해 적은 것은 정상이다 — 멜론과 이어진 곡이
66,036개(전체의 1.0%)뿐이다.

### 인덱스와 용량

```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes WHERE tablename = 'music';

SELECT pg_size_pretty(pg_total_relation_size('music')) AS music_total;
```

HNSW 인덱스가 목록에 있어야 유사도 검색이 빠르다. 없으면 전체 스캔으로 동작한다(느리지만 결과는 맞다).

### 음악적으로 닮은 곡

pgvector의 `<->`는 L2 거리다. **질의 벡터를 서브쿼리로 넘기면 조용히 틀린 답이 나온다** — 실행계획에서
`InitPlan`으로 들어가 HNSW가 값을 쓰지 못한다(2026-09-10 실측 recall 0.0000). 좌표를 먼저 읽어서 넘긴다.

```sql
-- 1) 좌표를 읽는다. 결과 셀을 복사한다.
SELECT location FROM music WHERE id = 1;

-- 2) 복사한 값을 리터럴로 붙여 넣는다.
SELECT id, title, artist, location <-> '[복사한 좌표]'::vector AS dist
FROM music
WHERE id <> 1
ORDER BY location <-> '[복사한 좌표]'::vector
LIMIT 10;
```

DBeaver 파라미터(`:qvec`)를 써도 되지만, 실행할 때마다 값을 다시 묻는다.

거리 눈금: 같은 녹음 `< 1.66`, 잘 나온 10위 `2.3~4.2`, 유사도 낮음 기준 `4.91`, 무관한 두 곡 `~15.7`.

### 지도 화면 범위 (GiST 인덱스가 받는다)

```sql
SELECT id, (location::real[])[3] AS x, (location::real[])[4] AS y
FROM music
WHERE point((location::real[])[1], (location::real[])[2])
      <@ box(point(-2, -2), point(2, 2))
LIMIT 1000;
```

질의 형태 전체는 `data/ingest/map_layer_queries.sql`에 있다.

---

## 5. 비용 주의

`music`은 662만 행·1.4 GB고 컨테이너 메모리는 4 GB다. 다음은 전체 스캔이 들어 수 분 걸리거나 디스크로 샌다.

- `ORDER BY` + `LIMIT` 없는 조회
- `unnest(location)` — 행이 16배(1억 600만)로 불어난다
- `percentile_cont` 같은 전체 정렬 집계
- `title`/`artist`에 대한 `LIKE '%...%'` (인덱스가 없다)

먼저 표본으로 돌린다.

```sql
WITH s AS (SELECT location FROM music TABLESAMPLE SYSTEM (1))
SELECT dim,
       ROUND(AVG(val)::numeric, 4)    AS avg_val,
       ROUND(STDDEV(val)::numeric, 4) AS std_val
FROM s, unnest(s.location::real[]) WITH ORDINALITY AS t(val, dim)
GROUP BY dim ORDER BY dim;
```

`TABLESAMPLE SYSTEM (1)`은 1% 표본이다. 축 표준편차가 pc1 **6.36**에서 pc16 **1.55**로 내려가면 좌표가
정상이다(PCA는 분산이 큰 축부터 나온다).

오래 걸리는 질의를 끊으려면 DBeaver의 취소 버튼을 쓴다. 그래도 남아 있으면 psql에서 확인한다.

```sql
SELECT pid, state, now() - query_start AS runtime, left(query, 80)
FROM pg_stat_activity WHERE state <> 'idle' ORDER BY query_start;
```

---

## 6. Neo4j Browser

같은 방식으로 포트 둘을 터널링한다. Bolt(7687)와 HTTP(7474)가 모두 필요하다.

```bash
ssh -i <키경로> -N \
  -L 7474:<neo4j컨테이너IP>:7474 \
  -L 7687:<neo4j컨테이너IP>:7687 \
  ubuntu@j15a405.p.ssafy.io
```

`http://localhost:7474` → Connect URL `bolt://localhost:7687`, 계정은 `/etc/ody/neo4j.env`.

```cypher
MATCH (m:Music)-[:HAS_GENRE]->(g:Genre) RETURN m, g LIMIT 50;
```

`(:Music)` 노드가 662만 개다. `LIMIT` 없는 `MATCH`를 Browser에서 돌리지 않는다.

---

## 7. 하지 말 것

- 자격증명을 저장소·문서·메신저·스크린샷에 남기기
- 운영 DB에서 `UPDATE`/`DELETE`/`DROP`/`TRUNCATE` 실행. 스키마·데이터 변경은 적재 스크립트와 마이그레이션으로만 한다
- 결과 그리드에서 셀 편집 (2번의 읽기 전용 설정으로 막는다)
- 포트를 host에 publish하거나 방화벽을 여는 것. 접근 방식 변경은 인프라 담당과 합의한다
- 662만 행 전체를 로컬로 내려받기
