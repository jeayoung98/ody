# 13 장르 계층 — tasks (Jira S15P21A405-36)

| # | 작업 | 완료 조건 | 상태 |
|---|---|---|---|
| T1 | 게이트 등록 `gates/genre_gate_v1.json` (측정 전) | 파일 커밋, `min_top1_accuracy`·`tau_genre`·`on_fail` 기재 | ⬜ |
| T2 | 태그 정규화 + 동의어 표 | `pipeline/genre_synonyms.json`, `tests/test_genre.py::test_normalize` | ⬜ |
| T3 | 곡 단위 태그 집계 + 태그 없는 곡 규모 보고 | `work/genre_by_song.parquet`, `output/genre_coverage.json` | ⬜ |
| T4 | log-odds 가중치 학습 (브릿지 80%) | `output/genre_tag_weights.json` | ⬜ |
| T5 | 홀드아웃 평가 | `output/genre_eval.json` top-1 ≥ 0.60 (AC3), 국내 장르 수치 별도 기재 | ⬜ |
| T6 | 카탈로그 4개 컬럼 주입 + 격리 큐 | `test_genre_columns` (AC1·AC4), `work/genre_unclassified.parquet` | ⬜ |
| T7 | 노드 track_count 불변식 | `test_track_count_consistency` (AC5) | ⬜ |
| T8 | depth-1 분포 방향 확인 | `test_genre_depth1_direction` (AC6) | ⬜ |
