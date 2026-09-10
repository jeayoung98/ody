# 18 적재 파이프라인 — plan

## 입력
| 무엇 | 어디 | 쓰는 컬럼 |
|---|---|---|
좌표 | `serving/<v>/coords_v2.parquet` | `mbid`, `pc1..pc16` |
메타 | `work/catalog_v2.parquet` | `mbid`, `title_raw`, `artist_raw`, `length`, `flag_*` |
bpm | `work/v2_feats/*.parquet` | `mbid`, `rhythm.bpm` |
장르 | `output/bridge_v2.parquet` | `mbid`, `gnr` (파이프 구분 코드) |

정렬 규약을 그대로 쓴다. `coords_v2` 의 행 순서가 `catalog_v2` 에서 `excluded=False` 인 행 순서와 같다(2026-09-10 검증). 그래서 조인 없이 위치로 붙일 수 있다. `v2_feats` 와 `bridge_v2` 는 mbid 조인이 필요하다.

`v2_feats` 는 30파트 중 28파트다(part10·part24 없음, 열린 질문 Q7). `bpm` 이 733,146곡에서 NULL 이 된다. 그 사실을 적재 리포트에 남긴다.

## 적재 순서
```text
1. genre        먼저. music_genre 가 genre_id 를 참조한다
2. music        인덱스 없이 COPY
3. music_genre  music 이 있어야 외래키가 성립
4. HNSW 인덱스  마지막. 662만 행 적재 후에 만든다
5. Neo4j        Postgres 적재가 끝난 뒤
```

4단계 순서가 중요하다. 인덱스를 걸어 놓고 662만 행을 넣으면 훨씬 느리다. 스펙 50 §규칙에 같은 항목이 있다.

## 적재 방식
`COPY` 를 쓴다. 스펙 17 실측으로 50만 행이 6초였고 662만 행이면 80초다. `INSERT` 문은 쓰지 않는다.

`location` 은 pgvector 텍스트 표현 `[v1,...,v16]` 으로 CSV 에 담는다. 값은 `%.6g` 로 찍는다. float32 유효자릿수를 넘지 않으면서 좌표 불변성(AC2)을 지킨다.

## Neo4j 적재
간선이 10만 개 수준이라 `LOAD CSV` 로 충분하다. 스펙 17 실측으로 간선 10,695개/초였으니 10만 개면 10초다. kNN 그래프(2억 간선, 5시간)와 규모가 다르다.

```cypher
CREATE CONSTRAINT music_mbid IF NOT EXISTS FOR (m:Music) REQUIRE m.mbid IS UNIQUE;
LOAD CSV WITH HEADERS FROM 'file:///music.csv' AS r
CALL { WITH r CREATE (:Music {mbid: r.mbid, location: split(r.location, ';'), genres: split(r.genres, ';')}) }
IN TRANSACTIONS OF 20000 ROWS;
```

`location` 배열 구분자를 `;` 로 쓴다. CSV 쉼표와 충돌을 피한다.

## 재적재 전략
번들이 바뀌면 좌표가 바뀐다. 스펙 17 과 같은 방식이다.

`music_new` 에 적재·인덱싱한 뒤 트랜잭션 안에서 이름을 바꾼다. 다운타임이 거의 없다. 이전 테이블은 며칠 두고 롤백 여지를 남긴다. 662만 행 `UPDATE` 는 죽은 튜플이 대량 생겨 `VACUUM` 이 필요하므로 쓰지 않는다.

Neo4j 는 `MATCH (m:Music) DETACH DELETE m` 후 재적재다. 스펙 17 실측으로 200만 간선 삭제가 6초, 171만 노드가 76초였다.

## 검증 방법
좌표 불변성이 가장 중요하다(AC2). 적재 후 무작위 1,000행을 읽어 `coords_v2.parquet` 과 비트 단위로 비교한다. `real`(float32) 로 저장하므로 왕복해도 값이 변하지 않아야 한다.

`bpm` 은 `v2_feats` 의 `rhythm.bpm` 과 상대오차 0 이어야 한다. 같은 float32 값을 옮기는 것이라 오차가 있으면 형변환이 잘못된 것이다.

## 리스크
- **`youtube_url` 을 누군가 채우려 할 위험.** 규칙 6 위반이고 API 할당량으로도 불가능하다. AC4 가 전 행 NULL 을 검사해서 막는다.
- **장르 커버리지 1% 를 결손으로 오해할 위험.** 서비스가 장르 없는 곡을 예외로 다루면 99% 가 깨진다. AC6 이 그 수를 명시한다.
- **`bpm` NULL 733,146곡.** `v2_feats` 2파트 누락(Q7) 때문이다. 재추출하면 사라진다.
- **인덱스 빌드 시간.** 스펙 17 T1(자원 상향) 없이는 4~6시간이다. 적재를 시작하기 전에 확인한다.
