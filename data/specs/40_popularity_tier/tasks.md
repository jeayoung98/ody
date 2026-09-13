# 40 비인기 티어 — tasks (결정 D5, 2차)

⛔ **보류.** 1차 배포(09-14) 이후 착수한다. 아래는 착수 시 시작점이며, 착수 전에 spec 의 수용 기준을 사람이 승인한다.

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | MLHD 청취 커버리지 측정 (전체·한국곡·장르별) | `output/mlhd_coverage.json` | ⛔ |
| T2 | 발매연도 조인 커버리지 | `output/release_date_coverage.json` | ⛔ |
| T3 | 게이트 등록 `gates/tier_gate_v1.json` (측정 전) | 경계·상한·`on_fail` 기재 | ⛔ |
| T4 | 티어 부여 + 카탈로그 컬럼 | `tests/test_tier.py::test_tier_columns` (AC1) | ⛔ |
| T5 | 티어 2 비율 확인 | `output/tier_report.json` (AC2) | ⛔ |
| T6 | 검색 후순위 반영 + `include_tier2` | `test_tier_ordering` (AC4), `test_tier2_direct_lookup` (AC3) | ⛔ |
| T7 | Hit@10 회귀 확인 | `output/bench_neighbors_tier.json` ±5% (AC5) | ⛔ |
