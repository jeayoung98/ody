# 11 여정 — tasks (09-09)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | `postprocess_rules.json` 에 `journey{artist_cap:2, far_dist:10.7, n_min:10, n_max:20}` 추가 (basis 병기) | 계약 검사 통과 | ⬜ |
| T2 | `retrieval/journey.py::linear` 이식 | `tests/test_journey.py::test_linear_golden` (2 여정 동일) | ⬜ |
| T3 | `choose_n`, `far` 판정 | `test_far_n` (15.29 → 15) | ⬜ |
| T4 | `axis_dp` 이식 | `test_axis_golden` | ⬜ |
| T5 | `/journeys` 엔드포인트 | `test_api_journeys` 200/404/422, 100쌍 스모크 100% 응답 | ⬜ |
| T6 | 벤치 `tests/bench_journey.py` → `output/bench_journey.json` | AC1 수치 | ⬜ |
| T7 | (선택) `polyline` + 리프 중심 aux 파일 | far 여정 1개 비교표 | ⬜ |
