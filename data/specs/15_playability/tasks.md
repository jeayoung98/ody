# 15 재생 가능 여부 — tasks (Jira S15P21A405-40)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 외부 서비스 선택 + 쿼터·약관 확인 | `docs/playability_api_notes.md` (상한·캐시 정책·근거) (AC5) | ⬜ |
| T2 | 게이트 등록 `gates/playability_gate_v1.json` (측정 전) | 파일 커밋, `min_rate_overall`·`on_below` 기재 | ⬜ |
| T3 | 표본 층화 10,000곡 | `work/playability_sample_mbids.parquet`, 층별 수 로그 | ⬜ |
| T4 | MBID → ISRC (덤프, API 호출 0) | `work/mbid_isrc.parquet`, 커버리지 수치 | ⬜ |
| T5 | 외부 조회 + 캐시 | `work/playability_cache.parquet`, 호출 수 ≤ 상한 | ⬜ |
| T6 | 완전일치 폴백 (세 조건 전부) | `tests/test_playability.py::test_exact_match_strict` 위반 0 (AC3) | ⬜ |
| T7 | 집계 리포트 | `output/playability_sample.json` (AC1) | ⬜ |
| T8 | ISRC 100건 수동 확인 | `output/playability_spotcheck.md` (AC2) | ⬜ |
| T9 | 카탈로그 4개 컬럼 주입 | `test_playability_columns` (AC6) | ⬜ |
| T10 | 게이트 판정 → DECISIONS 기록 | `specs/DECISIONS.md` 새 번호 (AC4) | ⬜ |
