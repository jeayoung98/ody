# 00 서빙 아티팩트 계약 — spec

상태 🔶 · 계약 버전 **contract v1** (2026-09-07) · 검사기 `tests/check_contract.py`

## 목적
지도 한 판을 서비스·평가·Spark 파이프라인이 **같은 파일 묶음**으로 주고받게 한다. 번들 안의 모든 구성요소는 함께 fit 되었으므로 함께 버전되고 함께 교체된다.

## 범위
`serving/<bundle_version>/` 디렉터리 하나 = 아티팩트 하나. 포인터 `serving/CURRENT.json` 이 서비스가 읽는 번들을 가리킨다.

## 필수 파일과 스키마

| 파일 | 형식 | 스키마 / 제약 |
|---|---|---|
| `manifest.json` | JSON | §manifest |
| `coords_v2.parquet` | Parquet | `mbid: string`(소문자 UUID, **유일**), `pc1..pc16: float32`(**전부 finite**). 행 수 = `manifest.songs` |
| `map_tree/node_paths_v2.parquet` | Parquet | `mbid: string`, `leaf_id: string`(`root(.[0-3]){6}`). 행 수 = `manifest.songs`, mbid 집합 = coords 의 mbid 집합, distinct leaf_id = `manifest.map_tree.n_leaves` |
| `map_tree/tree.json` | JSON | `max_depth, min_node, seed, split_rule, n_songs, n_nodes, n_leaves, nodes{id → {id, depth, size, children[4] or [], leaf, local_explained_variance_2d}}`. `len(nodes)==n_nodes`, leaf 노드 수 == n_leaves, 자식은 부모 id + `.k` |
| `map_tree/split_axes.npz` | npz | 내부 노드마다 `axes_<id>: (2,16) f32`, `median_<id>: (2,) f32`, `mean_<id>: (16,) f32`. 키 수 = 3 × (n_nodes − n_leaves) |
| `map_tree/quality_by_depth.csv` | CSV | `depth,n_nodes,n_leaves_at_depth,songs_median,songs_p10,songs_p90,songs_min,songs_max` 행 depth 0..max_depth |
| `model_bundle.npz` | npz | `impute_median(270) delta_f(270) scaler_center(270) scaler_scale(270) winsorize_clip() pca_components(16,270) pca_mean(270) explained_variance_ratio(16)` 전부 f32 |
| `feature_list.json` | JSON | `features: [270 str]`, `skew_transform: {feature → "" | "log1p" | "signed_log1p"}` 키 집합 == features |
| `fit_manifest.json` | JSON | `fit_sample_n, fit_sample_mbid_sha256, seed, selection, libraries, generated` |
| `postprocess_rules.json` | JSON | `version, tau_dup.value, artist_cap.value, tau_far.value, length_range_s.{min,max}, hub_penalty.enabled, display_filter.enabled` (각 항목 `rule`, `basis` 문자열) |

카탈로그(`work/catalog_v2.parquet`)는 번들 밖(대용량, git 제외)이지만 계약의 일부다: `mbid, canonical, artist_raw, title_raw, length, leaf_id, node_d1, node_d2, is_bridge, is_korean, excluded: bool, excluded_reason: list<string>, flag_*: bool`. `manifest.catalog` 가 경로, `manifest.catalog_sha256` 이 해시(v2.2+).

## manifest.json 필수 키
```
bundle_version   "v<major>.<minor>-pca16-<YYYY-MM-DD>"  (major = fit 변경, minor = 카탈로그·규칙만 변경)
status           "PROMOTED ..." | "CANDIDATE ..." | "ARCHIVED ..."
k=16  n_features=270  seed  songs  fit_sample  explained_variance  explained_variance_per_axis[16]
extractor_version  cohort_fingerprints[]  correction  pipeline[]  map_tree{max_depth,min_node,n_leaves,songs_per_leaf_median}
promoted_at  promotion_gate{gate_id, results}          # PROMOTED 일 때 필수
songs_before_exclusion  exclusion_rules  exclusion_rules_hash  excluded_total  catalog
files{ <상대경로> → sha256 }  catalog_sha256  contract_version  created_at   # v2.2 부터 필수 (v2.1 은 경고)
```

## 버전 규칙
- **major**(v2→v3): 특징·전처리·PCA·트리 중 하나라도 재학습. 좌표가 바뀐다. 검증 게이트 재등록·재통과 필수.
- **minor**(v2.1→v2.2): 카탈로그 규칙·후처리 규칙·플래그만 변경. 좌표·트리 동일(`coords`, `split_axes`, `model_bundle` 해시가 이전 minor 와 같아야 함 — 검사기가 확인).
- 승격(`PROMOTED`)은 계약 검사 통과 + 게이트 결과가 manifest 에 있을 때만. `CURRENT.json` 교체가 배포·롤백 단위.

## 수용 기준 (검사기가 전부 기계로 판정)
- AC1 `python tests/check_contract.py serving/v2.1-pca16` → exit 0 (v2.1 은 `files`/`catalog_sha256` 없음 → **경고**만).
- AC2 `python tests/check_contract.py serving/v2.2-pca16 --strict` → exit 0 (해시·contract_version 필수).
- AC3 v2.2 의 `coords_v2.parquet`·`split_axes.npz`·`model_bundle.npz` sha256 == v2.1 의 것 (minor 규칙).
- AC4 `pytest tests/test_contract.py` 가 `serving/CURRENT.json` 이 가리키는 번들에 대해 통과. `git commit` 훅이 이 테스트를 돌린다.
- AC5 검사기 실행 시간 ≤ 60s (6.6M 행 기준, 이 PC).

## 비범위
- 아티팩트 생성 자체(→ `20_spark_pipeline`), API 응답 스키마(→ `10/11/12`).
