# 10 이웃 검색 — tasks (09-08)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | `retrieval/artifact.py` 번들 로더 (CURRENT → coords/catalog/graph/rules, 제외 마스크, 그래프-좌표 해시 대조) | `tests/test_artifact.py`: 로드 ≤ 60s, N==manifest.songs, 마스크 수 == excluded+길이 위반 | ⬜ |
| T2 | `retrieval/postprocess.py` (apply_rules 이식 + flag 후순위) | `tests/test_postprocess.py`: 합성 케이스 6개(접힘·상한·길이·제외·후순위·미달) | ⬜ |
| T3 | `retrieval/neighbors.py` 그래프 경로 + 정확 폴백 | `tests/test_neighbors.py`: 폴백 트리거, 결과 규칙 위반 0 | ⬜ |
| T4 | `retrieval/search.py` DuckDB FTS + LIKE 폴백 | AC4 4개 질의 ≤ 100ms | ⬜ |
| T5 | `retrieval/api.py` 3 엔드포인트 + /health | `tests/test_api.py` (TestClient) 200/404/422 | ⬜ |
| T6 | `tests/bench_neighbors.py` → `output/bench_neighbors.json` | AC1~AC3 수치 기록 | ⬜ |
