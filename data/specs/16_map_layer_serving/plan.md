# 16 map_layer 적재 — plan

## 단계
`pipeline/build_map_layer.py --bundle serving/<version> --catalog work/catalog_v2.parquet --out work/map_layer/`

1. **트리 읽기** — `map_tree/tree.json` 에서 노드 5,461개의 `id, depth, size, children, leaf, local_explained_variance_2d`.
2. **곡 집계** — `map_tree/node_paths_v2.parquet`(mbid, leaf_id) + 카탈로그(`excluded`, 길이 규칙)로 리프별 유효 곡 수를 센 뒤, **리프에서 위로 합산**해 내부 노드 `track_count` 를 만든다. 위에서 아래로 각각 세지 않는다 — 합산으로 만들면 AC3 불변식이 구조적으로 성립한다.
3. **중심 좌표** — 리프별 `pc1`,`pc2` 평균(유효 곡만). 내부 노드는 자식 중심의 **곡 수 가중 평균**. 계산 경로는 이 잡 하나뿐이다(D12).
4. **축 라벨 조인** — `serving/<version>/aux/axis_labels.json` 이 있고 `bundle` 이 일치하면 조인, 아니면 전부 null.
5. **parquet 산출** — `work/map_layer/map_layer.parquet`, `work/map_layer/track_position.parquet`. DB 적재는 스펙 50 의 스키마 확정 후 `COPY`.

## 왜 parquet 을 먼저 만드는가
스펙 50(DB 스키마·마이그레이션 도구)이 아직 미결정이다. parquet 을 중간 산출물로 두면 스키마가 정해지기 전에도 값 검증(AC1~AC5)을 끝낼 수 있고, DB 적재는 `COPY` 한 줄이 된다. 스펙 50 이 막혀도 이 스펙은 진행된다.

## DB 적재 (스펙 50 확정 후)
```sql
COPY map_layer      FROM '<map_layer.csv>'      WITH (FORMAT csv, HEADER true);
COPY track_position FROM '<track_position.csv>' WITH (FORMAT csv, HEADER true);
```
인덱스는 적재 **후**에 만든다(적재 중 인덱스 유지는 6.6M 행에서 느리다). 필요한 인덱스: `track_position(leaf_id)`, `track_position(mbid)` UNIQUE, `map_layer(parent_id)`.

## 벤치마크 (AC6, Jira 37 검증 게이트)
`output/map_layer_bench.json` 에 기록:
```json
{ "bundle": "...", "nodes": 5461, "rows_track_position": 0,
  "steps": { "tree_read_s": 0, "leaf_aggregate_s": 0, "rollup_s": 0, "centroid_s": 0, "write_s": 0 },
  "db_load_s": 0, "index_build_s": 0, "peak_rss_mb": 0 }
```
"노드 수 증가에 비례해 처리 시간이 단축되는지" 를 보려면 노드 수를 바꿔 재실행해야 하는데, 트리는 고정(깊이 6, 4,096 리프)이라 재학습 없이는 노드 수를 바꿀 수 없다(규칙 3). 대신 **depth 를 잘라 3·4·5·6 네 지점**으로 집계해 노드 수 대비 시간 곡선을 낸다. 이게 재학습 없이 같은 질문에 답하는 방법이다.

## 리스크
- **적재 시간·디스크** — `track_position` 6.6M 행. app-node 는 PostgreSQL·Neo4j·Backend 와 15GiB 를 나눠 쓴다(HANDOVER_TEAM §5). 적재 전에 디스크 여유를 확인하고, 부족하면 브릿지 곡 우선 부분 적재를 별도 결정으로 올린다.
- **AC7 이중 계산** — 12 와 16 이 각자 집계하면 언젠가 어긋난다. 3번 단계의 방식을 12 와 공유하거나, 12 가 16 의 산출물을 읽게 바꾼다. 어느 쪽이든 AC7 테스트가 어긋남을 잡는다.
- **부동소수** — 중심 좌표는 평균이라 계산 순서에 따라 마지막 자리가 흔들린다. AC4 는 **원본 좌표**에만 적용하고(복사이므로 bit 동일), 중심은 허용 오차 1e-6 으로 비교한다.
