# 16 map_layer 적재 — tasks (Jira S15P21A405-37)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | `pipeline/build_map_layer.py` 트리 읽기 + 리프 집계 | `work/map_layer/map_layer.parquet` 5,461행 (AC1) | ⬜ |
| T2 | 리프→루트 롤업 | `tests/test_map_layer.py::test_rollup_invariant` (AC3) | ⬜ |
| T3 | 중심 좌표 (가중 평균) | `test_centroid_weighted` (오차 1e-6) | ⬜ |
| T4 | `track_position` 산출 | `test_track_position_rows` (AC2), `test_coord_identity` bit 일치 (AC4) | ⬜ |
| T5 | 축 라벨 조인 (스펙 14, 없으면 null) | `test_axis_label_join_optional` | ⬜ |
| T6 | 멱등 확인 | `test_idempotent` 2회 실행 결과 동일 (AC5) | ⬜ |
| T7 | depth 3·4·5·6 벤치마크 | `output/map_layer_bench.json` (AC6) | ⬜ |
| T8 | 스펙 12 API 와 값 대조 | `test_size_matches_tree_api` 5,461 노드 전부 (AC7) | ⬜ |
| T9 | DB 적재 스크립트 (스펙 50 확정 후) | `ops/` 또는 `pipeline/load_map_layer.sql`, 적재 시간 기록 | ⬜ |
