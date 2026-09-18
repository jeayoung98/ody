# 19 videoid API — tasks

| # | 작업 | 완료 조건 | 상태 |
| --- | --- | --- | --- |
| 1 | resolver 를 `data/videoid/` 로 편입, `duration` 을 선택 항목으로 | `tests/test_videoid_resolver.py::test_missing_duration_still_answers` | ✅ |
| 2 | 임베드 검증 추가 (`playable_in_embed`·`availability`·`is_live`·`age_limit`) | `::test_embeddable_rejects_unplayable_states` · `::test_embeddable_accepts_public_embeddable_video` | ✅ |
| 3 | 확정 경로에 임베드 조건 적용 | `::test_non_embeddable_official_track_is_not_verified` | ✅ |
| 4 | 추측 후보도 임베드 확인 후 채택, 예산 3회 | `::test_guess_skips_candidate_that_cannot_embed` · `::test_guess_stops_after_the_embed_check_budget` | ✅ |
| 5 | `PLAY_THRESHOLD = 0.6` 판정 | `::test_guess_above_threshold_is_playable_when_it_embeds` · `::test_guess_below_threshold_is_unplayable` | ✅ |
| 6 | 백엔드 계약 `GET /videoid` 구현 | `::test_backend_contract_shape_for_verified` · `::test_backend_contract_best_is_null_when_unplayable` | ✅ |
| 7 | 검색 실패와 재생 불가 구분 | `::test_search_failure_is_retryable_not_unplayable` · `::test_backend_contract_marks_search_failure_retryable` | ✅ |
| 8 | `requirements.txt` 에 `yt-dlp` 추가 | `data/.venv/Scripts/pip install -r data/requirements.txt` 후 `python -c "import yt_dlp"` | ✅ |
| 9 | 0.6 임계값 게이트 등록 (규칙 1) | `gates/videoid_threshold_v1.json` + 한글·영문 표본 오탐률 측정 | ⬜ |
| 10 | 한국 곡 추측 정책 결정 (규칙 8) | `specs/DECISIONS.md` 새 번호 | ⬜ |
| 11 | 추측값 DB 저장 여부 결정 | 백엔드·기획 합의 기록 | ⬜ |

9~11 은 팀 결정이 필요해 이 이슈 범위 밖이다.
