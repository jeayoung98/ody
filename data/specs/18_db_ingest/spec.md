# 18 적재 파이프라인 (music·genre·music_genre + Neo4j) — spec

상태 ✅(2026-09-11 적재·인덱스 완료) · Jira **S15P21A405-125**(스펙) · **S15P21A405-209**(적재 1단계) · 결정 **D11**, **D13** · 선행: 스펙 17 T1(Postgres 자원 상향)

## 목적
Spark 가 만든 좌표와 카탈로그를 서비스가 쓰는 형태로 PostgreSQL 과 Neo4j 에 적재한다.

## 5단계 (사용자 지정, 2026-09-10)

```text
1. 원본 고차원  →  16차원                      스펙 20 (2,929 → 389 → 270 → 16)
2. music 테이블 적재                            mbid title artist release_year bpm
                                                duration album youtube_url location
3. genre 테이블 적재                            없으면 문자열로 추가
4. music_genre 적재                             music_id + genre_id
5. Neo4j 적재                                   music_id + genre 배열 + location
   +  필요 없는 곡 잘라내기                     스펙 20 S1·S5 가 자른다 (아래 절)
```

1단계와 잘라내기는 이 스펙의 범위가 아니다. 스펙 20 이 만든 `coords_v2.parquet` 을 입력으로 받고, 이 스펙은 행 수를 검증만 한다.

## ⚠️ 실제 스키마가 이 스펙 초안과 다르다 (2026-09-10 확인)

BE 가 `ody` DB 에 세 테이블을 **이미 만들어 뒀다**(전부 0행, pgvector 0.7.0, `location vector(16)` 확인). 이 스펙은 **실제 DDL 을 따른다**. 아래 표는 실측이다.

```sql
music        id BIGINT PK · mbid VARCHAR(64) NOT NULL · title VARCHAR(200) NOT NULL
             artist VARCHAR(500) · release_year SMALLINT · bpm NUMERIC(5,1)
             duration INT · album VARCHAR(200) · youtube_url TEXT
             location VECTOR(16) · play_cnt INT NOT NULL DEFAULT 0
             youtube_cnt INT NOT NULL DEFAULT 0
genre        id BIGINT PK · name VARCHAR(100) NOT NULL
music_genre  id BIGINT PK · music_id BIGINT NOT NULL · genre_id BIGINT NOT NULL
```

| 초안 | 실제 | 적재에 미치는 영향 |
|---|---|---|
| `mbid` 가 PK | **`id BIGINT` 가 PK**, `mbid` 는 별도 컬럼 | id 값을 우리가 넣어야 한다(D13) |
| `music_genre(mbid, genre_id)` | **`music_genre(music_id, genre_id)`** | 장르도 mbid → id 매핑을 거친다 |
| `duration real`(초, 소수) | `INT` | 초 단위로 반올림한다 |
| `bpm real` | `NUMERIC(5,1)` | 소수 1자리, 범위 밖은 NULL |
| `genre(genre_id, name, source)` | `source` 없음 | 출처 표기를 DB 에 넣지 못한다. 지금 코드는 전부 멜론이다 |
| — | `play_cnt`·`youtube_cnt` NOT NULL | 0 으로 채운다 |
| `title` 길이 제한 없음 | `VARCHAR(200) NOT NULL` | 200자로 자른다(실측 700곡) |
| `artist` | `VARCHAR(500)` | 실측 자른 곡 0 |

`music.id` 에 DEFAULT·IDENTITY·시퀀스가 없다(`playlist_id_seq` 만 존재). `music.mbid` UNIQUE 도 없고 `music_genre` 에 UNIQUE·FK 도 없다.

### D13 — id 는 mbid 오름차순 1..N
`mbid` 로 정렬해 **1 부터 6,624,399** 를 붙인다. mbid 가 유일하므로 같은 입력이면 항상 같은 id 다. 재적재해도 id 가 흔들리지 않는다.

적재 뒤 **BE 는 새 곡을 `6,624,400` 부터** 넣어야 한다. 시퀀스를 쓰려면 `setval('music_id_seq', 6624399)`.

## 적재 1단계 — CSV 만들기 (완료 2026-09-10)

`ingest/build_csv.py` 가 네 파일을 만든다. 실측은 `output/db_ingest_csv_2026-09-10.json`.

| 산출 | 크기 | 행 수 |
|---|---|---|
| `music.csv` | 2.72 GB | **6,624,399** (id 1..6,624,399) |
| `genre.csv` | 289 B | **29** (멜론 대분류 코드) |
| `music_genre.csv` | 1.18 MB | **71,285** (곡 66,036개) |
| `neo4j_music.csv` | 1.43 GB | 6,624,399 (id·mbid·좌표·장르 배열) |

입력은 `coords_v2.parquet`(적재 대상 정의) + `catalog_v2.parquet`(제목·아티스트·길이) + `v2_song_meta.parquet`(`gnr`) + `v2_feats`(`rhythm.bpm`).

**좌표는 float32 가 그대로 오간다.** `repr(float(x))` 는 double 왕복 최단 표기이고 원값이 float32 였으므로 pgvector 의 float4 로 되돌려도 비트가 같다. 테스트가 왕복을 검사한다(AC2).

### 실측이 스펙 초안 숫자와 다른 곳 둘
1. **장르 곡 수 67,472 → 66,036.** 67,472 는 **manifest 기준**이고 그중 **1,436곡이 S5 제외 규칙에 걸려** `coords` 에 없다. 링크는 71,285개다(곡당 코드 여러 개). AC5·AC6 을 이 수치로 고쳤다.
2. **`bpm` 이 733,146곡에서 NULL.** `v2_feats` 가 28/30 파트라 그렇다(열린 질문 Q7). `coords` 에만 있는 곡 수와 정확히 같다.

## 적재 2단계 — 실제 DB 적재 (완료 2026-09-10)

실측은 `output/db_ingest_bench.json`.

| 무엇 | 결과 |
|---|---|
| `music` | **6,624,399행** (id 1..6,624,399 연속, mbid 소문자 UUID 중복 0) |
| `genre` | **29행** |
| `music_genre` | **71,285행** (곡 66,036개) |
| Neo4j `(:Music)` | **6,624,399** 노드 |
| Neo4j `(:Genre)` | 29 노드 · `HAS_GENRE` **71,285** 관계 |
| COPY 시간 | music 66초 · music_genre 0.12초 · genre 2ms |
| CSV 전송 | 2.72 GB, 9분 18초 |
| 크기 | `music` 힙 1,376 MB(총 1,518 MB) · DB 2,540 MB · Neo4j 스토어 4.2 GB |
| Neo4j 적재 | Music 노드 653초 · 장르 그래프 157초 |

`location` 은 전 행 `vector(16)` 이고 세 컬럼(`release_year`·`album`·`youtube_url`)은 전 행 NULL 이다(AC4 통과).

### 자원은 재시작 없이 올렸다
```bash
docker update --memory 4g --memory-swap 4g --cpus 2 ody-postgres   # cgroup v2, 다운타임 0
SET maintenance_work_mem = '2GB';                                   # 세션 단위, 재시작 불필요
```
⚠️ **컨테이너가 재생성되면 원복된다.** compose 파일(`/home/ubuntu/ody-infra-rollout/infra/database/postgres/docker-compose.yml`)에 반영하는 것은 인프라 담당 몫이다. 되돌리기는 `docker update --memory 1g --cpus 1 ody-postgres`.

### 세 번 실패하고 알아낸 것
| 증상 | 원인 | 해결 |
|---|---|---|
| `syntax error at or near "/tmp/music.csv"` | inline `psql -c` 의 따옴표 중첩 | SQL 을 파일로 쓰고 `psql -f` |
| `null value in column "title" violates not-null` | 제목이 빈 문자열인 곡 **3,977개**. CSV 빈 칸을 COPY 가 NULL 로 넣는다 | `FORCE_NOT_NULL (title)` |
| `could not resize shared memory segment ... No space left on device` | HNSW 병렬 빌드가 컨테이너 `/dev/shm` 64 MB 를 넘김 | `SET max_parallel_maintenance_workers = 0` |
| `Could not find command :auto` | cypher-shell 5.26 에 `:auto` 가 없다 | 빼면 된다. 기본이 auto-commit |

### HNSW 인덱스 — 완료 (2026-09-11)
`maintenance_work_mem` 2 GB 로는 **2,757,295 튜플에서 그래프가 메모리를 넘겼다**(경고: `hnsw graph no longer fits into maintenance_work_mem`). 그 뒤는 디스크 기반이라 크게 느려진다. 취소하고 컨테이너를 8 GB 로 올려 `maintenance_work_mem = 6GB` 로 다시 빌드했다.

| 항목 | 값 |
|---|---|
| 빌드 시간 | **3,943초** (65분) |
| 인덱스 크기 | **2,330 MB** |
| 설정 | `maintenance_work_mem = 6GB`, `max_parallel_maintenance_workers = 0` |
| 이웃 검색 실측 | **13.9 ms** (662만 행, 리터럴 전달) |

⚠️ 병렬 빌드는 컨테이너 `/dev/shm` 64 MB 를 넘겨 `could not resize shared memory segment` 로 실패한다. 병렬을 꺼야 한다.

### 지도 레이어 인덱스는 스펙 16 이 맡는다
`music_l1_gist`·`music_l2_gist` 표현식 GiST 와 `map_sample` 은 스펙 16(D14)에서 다룬다. 재현은 `ingest/build_map_layer.sql`.

### 남은 것
| 무엇 | 상태 |
|---|---|
| DB 왕복 좌표 표본 검증(AC2) | CSV 왕복은 테스트로 통과. DB 에서 다시 읽어 비교하는 것은 남아 있다 |
| compose 파일에 자원 반영 | 인프라 담당 |
| `music.mbid` UNIQUE 등 제약 | BE 결정. 지금은 데이터 자체에 중복이 없다(distinct 6,624,399) |
| BE 에 전달 | 새 곡 id 는 **6,624,400** 부터 |

## music 테이블

필드마다 **지금 값이 있는지**를 표시한다. 없는 것은 컬럼만 만들고 1차에는 NULL 이다(D11).

| 필드 | 타입 | 상태 | 출처 |
|---|---|---|---|
`mbid` | `text PK` | ✅ 보유 | `catalog_v2.mbid` (소문자 UUID) |
`title` | `text` | ✅ 보유 | `catalog_v2.title_raw` |
`artist` | `text` | ✅ 보유 | `catalog_v2.artist_raw` |
`duration` | `real` | ✅ 보유 | `catalog_v2.length` (초) |
`bpm` | `real` | ✅ 보유 | **270 특징 목록의 3번째 `rhythm.bpm`**. `v2_feats` 에서 꺼낸다 |
`location` | `vector(16)` | ✅ 보유 | `coords_v2.parquet` 의 `pc1..pc16`. **PCA-16 지도 좌표**(D7) |
`release_year` | `smallint` | ⬜ **1차 NULL** | 없음. 아래 참조 |
`album` | `text` | ⬜ **1차 NULL** | 없음. 아래 참조 |
`youtube_url` | `text` | ⬜ **1차 NULL** | 채우지 않는다. 아래 참조 |

### `location` 은 지도 좌표다
아티스트 출신 지역이 아니다(2026-09-10 사용자 확인). PCA-16 좌표 그대로이고 차원은 D7 로 16 이 확정돼 있다. 거리는 L2 이며 후처리 임계값(τ_dup 1.6624, τ_far 4.912)이 모두 L2 기준이라 다른 거리로 바꾸면 규칙이 깨진다.

### 비어 두는 세 필드
**`release_year`** — `pipeline/catalog_audit.py` A8 에 기록이 있다. AB 문서의 `metadata.tags.date` 를 제목 추출 당시 수집하지 않았고, 연도를 쓰려면 원본 재패스가 필요하다. MusicBrainz canonical dump 도 팀 저장소에 없다. D5 가 이미 2차로 미뤄둔 항목이다.

**`album`** — 같은 이유다. canonical dump 의 release group 조인이 필요하다.

**`youtube_url`** — **채울 방법이 없다.** 규칙 6 이 음원 재생·다운로드·임베드를 금지하고 검색 URL 만 허용한다. D5 기록으로 YouTube Data API 는 하루 100곡 할당량이고 스크래핑은 약관 위반이다. 662만 곡이면 66,000일이 걸린다.

대신 조회 시 **검색 URL 을 만들어 응답에 담는다.** 저장하는 값이 아니라 계산 필드이고, 만드는 쪽은 Backend 다(D12). 규칙 6 상 검색 URL 만 허용한다: `https://www.youtube.com/results?search_query=<아티스트>+<제목>` (URL 인코딩). 컬럼은 나중을 위해 남긴다.

## genre 테이블

```sql
CREATE TABLE genre (
    genre_id   bigserial PRIMARY KEY,
    name       text NOT NULL UNIQUE,     -- 없으면 삽입, 있으면 재사용
    source     text NOT NULL             -- 'melon' | 'acousticbrainz'
);
```

3단계의 "없으면 넣는다" 는 `INSERT ... ON CONFLICT (name) DO NOTHING` 이다.

## music_genre 테이블

```sql
CREATE TABLE music_genre (
    mbid      text   REFERENCES music(mbid) ON DELETE CASCADE,
    genre_id  bigint REFERENCES genre(genre_id),
    PRIMARY KEY (mbid, genre_id)
);
```

### ⚠️ 장르 커버리지가 1.0% 다
| 항목 | 값 |
|---|---|
장르 원천 | `output/bridge_v2.parquet` |
행 수 | 67,536 |
장르가 있는 행 | **67,472** |
멜론 장르 코드 종류 | 29 |
전체 곡(662만) 대비 | **1.0%** |

**662만 곡 중 6만7천 곡만 `music_genre` 행을 갖는다. 나머지 99% 는 장르가 없다.** 이건 결손이 아니라 현재 데이터의 사실이다. 서비스는 장르 없는 곡을 정상 상태로 다뤄야 한다.

코드 → 이름 매핑표(`genre_gn_all.json`)도 없다. 열린 질문 Q3 이다. 그때까지 `genre.name` 에는 코드 문자열(`GN0100` 등)이 들어가고 `source='melon'` 로 표시한다.

커버리지를 늘리려면 AB 자유 텍스트 태그(`work/genres_raw.parquet`, 23,203,978행)를 정규화해야 하고 그게 스펙 13 이다. 이 스펙의 범위 밖이다.

## Neo4j 적재 (5단계)

```cypher
(:Music {mbid, location: [16개 float], genres: [문자열 배열]})
```

**D9 와 충돌하지 않는다.** D9 는 *좌표 이웃 검색*을 pgvector 로 정한 것이지 Neo4j 를 금지한 것이 아니다. 이웃 검색을 Neo4j 로 하면 cold 40 ms 로 느려지므로(2026-09-10 실측) 그 용도로는 쓰지 않는다. 여기서 Neo4j 가 맡는 것은 곡–장르 관계 탐색이다.

간선 규모가 kNN 과 다르다. 곡당 장르 몇 개이고 커버리지가 1% 라 관계가 10만 개 수준이다. kNN k=30 의 2억 개와 비교가 안 된다. 현재 컨테이너 한도(2 GB, heap 512m)로 충분하다.

`location` 을 Neo4j 에 16개 float 배열로 넣지만 **거리 계산은 하지 않는다.** 그건 pgvector 담당이다. 여기 있는 이유는 그래프 질의 결과에 좌표를 함께 실어 보내기 위해서다.

## 필요 없는 곡 잘라내기 — 자르는 곳은 파이프라인이고, 적재는 검증한다

곡 수를 줄이는 단계는 **파이프라인 안에 둘**이다. 적재가 자르는 것이 아니다.

| 단계 | 어디서 자르나 | 행 수 |
|---|---|---|
| census 제출본 | — | 29,460,584 |
| S1 대표행 선택 | `spark/jobs/manifest_rows.py` (스펙 20) | 7,404,506 |
| S5 제외 규칙 R1~R9 | `spark/jobs/catalog_rules.py` (스펙 20) | **−780,107** |
| 적재 대상 | — | 6,624,399 |

`coords_v2.parquet` 은 S5 를 지나온 **체크포인트**다. `excluded=True` 인 곡이 거기에 없는 것은 파이프라인이 그 단계를 이미 실행했기 때문이고, 단계가 없다는 뜻이 아니다.

따라서 이 스펙의 일은 **자르기가 아니라 검증**이다. 적재 대상 행 수가 6,624,399 인지 확인하고(AC1), 다르면 파이프라인 쪽 문제로 올린다. 적재 단계에서 곡을 임의로 빼거나 더하지 않는다(규칙 2).

D1 이 길이 규칙을 60초~6분으로 좁히기로 정했고 그것이 v2.2 다. 아직 만들지 않았다. v2.2 로 가면 제외가 늘어 곡 수가 줄어든다.

`flag_comedy`, `flag_spoken`, `flag_fieldrec`, `flag_clipped`, `flag_low_sr` 는 **자르지 않고 표시만** 한다(규칙 2: 삭제 아님, 표시). `music` 테이블에 컬럼으로 실어 서비스가 후순위로 다루게 한다.

## 이름 충돌 정리 (D11)

| 스펙 | 기존 표기 | 이 스펙 |
|---|---|---|
50 | `track` | **`music`** 으로 통일 |
50 | `artist`, `track_artist` | 유지. `music` 의 `artist` 는 표시용 원문이고 정규화 테이블은 별개다 |
17 | `track_vector.vec` 별도 테이블 | **`music.location` 으로 합친다** |

스펙 17 이 좌표를 별도 테이블로 뺀 이유는 좌표만 바뀌는 재적재가 잦다는 것이었다. 지금은 파이프라인 전체를 다시 돌리는 구조라 그 이득이 작다. 조인이 하나 줄고 HNSW 인덱스는 `music.location` 에 그대로 걸린다.

⚠️ **스펙 17 파일은 MR !16 이 머지되면 이 저장소에 들어온다.** 그때 `track_vector` 절을 `music.location` 으로 고쳐야 한다. 그 MR 이 먼저 머지되지 않으면 두 스펙이 어긋난 상태로 남는다.

스펙 17 의 측정값과 함정은 그대로 유효하다. 특히 **질의 벡터를 서브쿼리로 넘기면 HNSW 가 틀린 결과를 낸다**(실행계획에서 `InitPlan` 으로 들어가고 자기 자신이 1위에 안 나온다). 좌표를 먼저 읽어 바인드 파라미터로 넘겨야 한다. pgvector 0.7.0 은 iterative index scan 이 없어 선택도 높은 `WHERE` 를 걸면 `LIMIT` 보다 적게 반환하는 것도 같다.

## 수용 기준
- AC1 `music` 행 수 == `manifest.songs`(6,624,399). 전 행의 `mbid` 가 소문자 UUID, `id` 가 1..6,624,399 연속(D13).
- AC2 `location` 이 `vector(16)` 이고, 무작위 1,000행이 `coords_v2.parquet` 과 **비트 단위로 같다**(Jira S15P21A405-35 좌표 불변성 게이트).
- AC3 `bpm` 이 `v2_feats` 의 `rhythm.bpm` 을 소수 1자리로 반올림한 값과 같다. **733,146곡은 NULL** 이다(파트 2개 누락, Q7). 표본 1,000행.
- AC4 `release_year`·`album`·`youtube_url` 은 전 행 NULL. 값이 들어 있으면 실패다(출처 없는 값이 섞였다는 뜻).
- AC5 `genre` 행 수 == **29**(멜론 코드 종류), `music_genre` 행 수 == **71,285**(곡 66,036개). 2026-09-10 CSV 실측값이다.
- AC6 `music_genre` 가 없는 곡이 **6,558,363**곡이고 그것이 정상임을 문서와 테스트가 함께 말한다.
- AC7 Neo4j `(:Music)` 노드 수 == `music` 행 수, `genres` 배열이 `music_genre` 와 일치. **통과** (6,624,399 노드, `HAS_GENRE` 71,285).
- AC8 적재 시간·인덱스 크기·디스크 사용량을 `output/db_ingest_bench.json` 에 기록한다. **완료.** COPY 66초, `music` 총 4,691 MB(HNSW 2,330 MB + GiST 421 MB × 2 포함), DB 4,704 MB.
- AC9 `pytest tests/test_db_ingest.py` 통과 (스키마·매핑·좌표 왕복 검사. 실 DB 없이 돈다). **2026-09-10 10건 통과.**

## 비범위
- DDL 작성. BE 가 이미 만들었다. 우리는 데이터만 넣는다(열린 질문 Q2 는 BE 쪽에서 해소됐다).
- `release_year`·`album` 수집. 원본 재패스가 필요하고 2차다.
- `youtube_url` 수집. 규칙 6 으로 금지.
- 장르 커버리지 확대. 스펙 13.
- Postgres 컨테이너 자원 상향. 스펙 17 T1.
- 사용자·플레이리스트 테이블. BE1 담당(Jira S15P21A405-89).
