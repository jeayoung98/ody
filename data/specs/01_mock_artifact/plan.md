# 01 목업 서빙 아티팩트 — plan

## 생성 경로
`scripts/build_mock_bundle.py --src serving/v2.1-pca16 --out serving/v0.0-mock --n 5000 --seed 42`

1. **표본 선정** — `output/bridge_v2.parquet`(67,536 브릿지 곡)에서 `qual_prepare.BUCKETS` 버킷별 균등 추출. 버킷 곡이 모자라면 남는 몫을 브릿지 전체에서 `n_submissions` 순으로 채운다. 결과 mbid 5,000개를 `serving/v0.0-mock/sample_mbids.json` 에 기록(재현용).
2. **coords** — 실번들 `coords_v2.parquet` 에서 표본 행만. 컬럼·dtype(float32) 그대로.
3. **node_paths** — 표본 행만. `leaf_id` 는 실제 값.
4. **tree.json** — 실 트리에서 표본이 채운 리프의 **조상 전부**를 남긴다. 남긴 내부 노드의 자식 4개는 유지하되 표본이 없는 자식은 `size: 0`, `children: []`, `leaf: true` 로 둔다. `n_nodes`·`n_leaves`·`n_songs` 를 다시 센다.
5. **split_axes.npz** — 남긴 내부 노드의 `axes_*`·`median_*`·`mean_*` 만. 키 수 = 3 × 내부 노드 수(계약 검사 조건).
6. **quality_by_depth.csv** — 목업 트리로 다시 집계(depth 0..6 행 유지).
7. **model_bundle.npz / feature_list.json / fit_manifest.json** — 실번들에서 그대로 복사. 작고(25KB) 전처리 계약이 같아야 BE 가 같은 코드로 읽는다.
8. **postprocess_rules.json** — 실번들 그대로. 임계값을 목업용으로 바꾸지 않는다(규칙 9).
9. **manifest.json** — 실번들 키를 그대로 두고 `songs`·`bundle_version`·`status`·`files`(재계산 sha256)·`created_at` 만 교체.
10. **목업 카탈로그** — `serving/v0.0-mock/catalog_mock.parquet`(5,000행, 계약의 카탈로그 컬럼 전부: `mbid canonical artist_raw title_raw length leaf_id node_d1 node_d2 is_bridge is_korean excluded excluded_reason flag_*`). 실번들과 달리 작아서 번들 안에 둔다. `manifest.catalog` 가 이 경로를 가리킨다.

## 계약 (BE·FE 가 의존하는 것)
목업과 실번들의 **차이는 `manifest.songs` 와 `manifest.bundle_version` 뿐**이다. 응답 스키마·필드 이름·타입·오류 코드(404/422/503)는 같다. FE 는 `bundle` 값을 화면에 노출하지 않고 캐시 키로만 쓴다(HANDOVER_TEAM §6).

## 교체 절차
`serving/CURRENT.json` 의 `bundle` 만 바꾸고 서비스 재기동. 코드·환경변수 변경 없음. 롤백은 반대로. 이게 AC3 이 검사하는 것이다.

## 리스크
- **트리 서브셋의 계약 위반** — 검사기는 내부 노드마다 자식 4개, `len(nodes)==n_nodes`, 리프 수 일치를 본다. 빈 자식을 지우면 FAIL. 4번 단계가 이걸 지킨다.
- **표본 편중** — 브릿지에만 있는 장르 분포라 실데이터와 다르다. FE 가 밀도 기반 UI 를 목업 수치로 튜닝하면 실데이터에서 깨진다. 배포 공지에 "밀도·곡 수는 목업 기준으로 판단하지 말 것" 을 넣는다.
- **git 크기** — 5,000행 parquet 는 수백 KB 지만 `split_axes.npz` 는 남긴 내부 노드 수에 비례한다. 20MB 를 넘으면 `--n` 을 줄인다.
