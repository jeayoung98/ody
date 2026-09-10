# 16 map_layer 적재 — spec

상태 ⬜ · Jira **S15P21A405-37** (프로젝트 최대 병목: 이게 끝나야 지도 탐색 E6 가 실데이터로 돈다) · 목표일 미정

## 목적
아티팩트의 트리와 좌표를 **서빙 테이블 형태**(`map_layer`, `track_position`)로 적재해, 탐색 BE 가 파일이 아니라 질의로 지도를 읽게 한다.

트리 탐색 읽기 API 는 Backend(Spring) 담당이다(D12). 이 스펙은 **적재까지**이고, BE 는 여기서 만든 `map_layer`·`track_position` 을 읽는다. 계산 경로가 하나뿐이라 두 경로 대조는 필요 없다.

## 범위 정정 (Jira 문구와 실제 아티팩트의 차이)
Jira 37 은 "depth별 PC 축 할당(설명력 순 2개씩)" 이라고 적혀 있다. 실제 v2.1-pca16 트리는 그렇지 않다:

| Jira 37 문구 | 실제 아티팩트 |
|---|---|
| depth 마다 전역 PC 축 2개를 할당 | **노드마다 local PCA-2** (`split_axes.npz` 의 노드별 `axes(2,16)`, `median(2)`, `mean(16)`) |
| 축이 depth 로 결정 | 축이 노드로 결정. 같은 depth 라도 노드마다 다르다 |

이 스펙은 **실제 아티팩트를 따른다**. 축 정보는 depth 가 아니라 노드 단위로 적재한다. 재학습은 하지 않는다(규칙 3).

## 산출물

### `map_layer` (5,461행 = tree.json 의 노드 수)
```
node_id          string   region_code. "root" 또는 root(.[0-3]){1,6}
depth            int      0..6
parent_id        string|null
track_count      int      excluded=false 이고 길이 규칙 통과한 곡 수
track_count_all  int      tree.json 원본 size (제외 반영 전)
has_children     bool
centroid_pc1     real     노드 곡 좌표 평균 (float32)
centroid_pc2     real
local_ev_2d      real     tree.json 의 local_explained_variance_2d
axis_label       string|null   스펙 14 산출물. 없으면 null
```

### `track_position` (카탈로그 곡 수)
```
mbid       string   소문자 UUID, UNIQUE
leaf_id    string   root(.[0-3]){6}
pc1..pc2   real     아티팩트 좌표 그대로
node_d1    string
node_d2    string
```

`pc3..pc16` 은 이 테이블에 넣지 않는다. 지도 표시는 2D 다. 16차원 좌표는 `music.location` 에 넣고 이웃 검색은 BE 가 pgvector 로 한다(스펙 17·18, D12).

## 규칙
- 좌표는 **아티팩트 값 그대로**. 재계산·재학습 금지(규칙 3, Jira 35 의 좌표 불변성 게이트).
- 제외 곡을 테이블에서 빼지 않는다. `track_position` 에는 전 곡이 들어가고, 제외 여부는 카탈로그 쪽 컬럼으로 판단한다(규칙 2).
- 번들 버전이 바뀌면 테이블 전체를 다시 만든다. 부분 갱신하지 않는다(좌표 정합성).

## 수용 기준
- AC1 `map_layer` 행 수 == `tree.json` 의 `n_nodes`(v2.1-pca16 기준 5,461), 리프 행 수 == `n_leaves`(4,096), depth 값이 0..6.
- AC2 `track_position` 행 수 == 카탈로그 행 수, `mbid` 중복 0, `leaf_id` 가 전부 `root(.[0-3]){6}` 형식.
- AC3 불변식: 모든 내부 노드에서 **자식 `track_count` 합 == 부모 `track_count`**, `track_count_all` 도 동일, `has_children == (자식 행 존재)`.
- AC4 **좌표 불변성** — `track_position.pc1/pc2` 가 아티팩트 `coords_v2.parquet` 의 값과 100% 일치(부동소수 비교가 아니라 bit 단위 동일, 둘 다 float32).
- AC5 **멱등** — 같은 번들로 두 번 적재하면 결과 테이블이 동일하다(행 수·값·정렬 무관 집합 비교).
- AC6 **배치 벤치마크** — 노드 수·행 수 대비 처리 시간을 `output/map_layer_bench.json` 에 기록한다(Jira 37 의 검증 게이트: 노드 수 증가에 따른 처리 시간 확인).
- AC7 **트리 원본과 일치** — `map_layer.track_count` 가 `map_tree/tree.json` 의 `nodes[<id>].size` 와 5,461 노드 전부에서 같다. (원래 문장은 스펙 12 의 읽기 API 응답과 대조하는 것이었다. D12 로 그 API 가 BE 로 갔고, 남은 기준은 트리 원본과의 대조다)
- AC8 `pytest tests/test_map_layer.py` 통과.

## 비범위
- **Neo4j 투영** — 6.6M 노드 × 30 간선 = 2억 간선은 15GiB 노드에 올릴 수 없다(HANDOVER_TEAM §5). 1차 미사용. 2차 후보는 브릿지 곡 top-10 만.
- 실시간 갱신·증분 적재. 번들 단위 전체 재생성만.
- 테이블 DDL 과 마이그레이션 도구 — 스펙 50.
- `pc3..pc16` 적재.
