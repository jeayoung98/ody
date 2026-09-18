# 19 videoid API — spec

상태 🔶 · Jira **S15P21A405-441** · 선행: 백엔드 `VideoIdApiClient`(S15P21A405-312)가 이미 이 계약을 호출한다

## 목적
곡 하나를 **재생 가능한 YouTube video ID** 로 판정하는 HTTP 엔드포인트를 저장소 안에 둔다.
지금 그 응답을 내려주는 `videoid_api.py` 는 개인 EC2 에만 있고 저장소에서 관리되지 않는다
(`backend/.../videoid/VideoIdLookupPort.java:8-9`). yt-dlp + rapidfuzz 퍼지매칭 결과를 그대로
저장하므로 실제로 재생되지 않는 영상이 `music.video_id` 에 들어간다.

## 스펙 15 · 규칙 6 과의 관계 (먼저 못박는다)

이 스펙은 **스펙 15 매핑 규칙 3 과 충돌한다.** 숨기지 않고 적는다.

| 문서 | 조항 | 이 스펙 |
| --- | --- | --- |
| `specs/15_playability/spec.md:38` | "**추측 금지** — 부분일치·유사도 매칭 금지" | **위반한다.** 유사도 0.6 이상을 재생 가능으로 판정한다 |
| `specs/15_playability/spec.md:39` | "모르는 것을 재생 가능으로 만들지 않는다" | **위반한다.** 단, `confidence` 로 구분해 내려보낸다 |
| `AGENTS.md` 규칙 6 (D15) | 길이 ±3초 + `embeddable == true`, 미달이면 비워 둔다 | 길이는 ±2초로 더 엄격. `embeddable` 은 **지킨다** |
| `AGENTS.md` 규칙 6 (D15) | 재생은 YouTube IFrame 임베드로만 | 지킨다. 임베드 불가 영상은 어떤 경로로도 채택하지 않는다 |
| `AGENTS.md` 규칙 8 | 한국 곡은 한글 완전일치만 | **미적용.** 아래 미해결 항목 참고 |

**추측 채택은 사용자(재영)의 명시적 요청이다** (2026-09-18). 팀 상의 없이 확정된 규칙이 아니므로
`DECISIONS.md` 에 번호를 받기 전까지 이 스펙은 🔶 이고, 추측값을 `music.video_id` 에 영구 저장할지는
백엔드·기획이 결정한다. API 는 판정 근거를 다 내려보내고 저장은 호출자가 결정한다.

임베드 검증은 추측이 아니다. `playable_in_embed`·`availability`·`is_live`·`age_limit` 을 실제로 조회해
확인하므로, "이 영상이 재생되는가"는 실측이고 "이 영상이 그 곡인가"만 추측이다.

## 계약 — 백엔드가 이미 호출하는 그 형태

```
GET /videoid?artist=<필수>&title=<필수>[&duration=<초>][&album=][&isrc=][&releaseYear=][&refresh=1]
```

```json
{ "best": { "videoId": "ugffpCgWBqs",
            "youtubeUrl": "https://www.youtube.com/watch?v=ugffpCgWBqs",
            "confidence": "verified",
            "score": null },
  "playable": true, "status": "matched_official_art_track",
  "reason": "official_metadata_verified", "threshold": 0.6,
  "retryable": false, "cacheHit": true, "checkedAt": "..." }
```

재생 불가면 `best` 가 `null` 이다. `backend/.../videoid/VideoIdApiResponse.java` 는 `best.videoId` 만
읽고 나머지는 `@JsonIgnoreProperties` 로 버린다 — 응답 필드를 늘려도 백엔드는 깨지지 않는다.

`GET /health` → `{"status":"ok","threshold":0.6}`.

`confidence` 는 셋 중 하나다.

| 값 | 뜻 | 판정 근거 |
| --- | --- | --- |
| `verified` | 공식 음원으로 확정 | 공식 채널 + 곡명 완전일치 + 길이 ±2초 + 앨범·ISRC·발매연도 무충돌 + 임베드 가능 |
| `best_guess` | 유사도 0.6 이상 추측 | 곡명 유사도·채널 유사도·길이 근접 가중합 + 임베드 가능 (실측) |
| `unplayable` | 재생 불가 | 후보 없음, 또는 최고점이 0.6 미만, 또는 상위 후보가 임베드 불가 |

## 판정 규칙

1. `artist`·`title` 은 필수다. 없으면 400.
2. `duration` 이 없으면 **확정하지 않는다** — 길이 대조가 불가능하므로 `verified` 가 나올 수 없고, 점수에서 길이 항을 뺀다. 백엔드 현재 계약이 `duration` 을 보내지 않으므로 사실상 전부 `best_guess` 또는 `unplayable` 이 된다.
3. 판정 기준은 상수 하나 `resolver.PLAY_THRESHOLD = 0.6` 이다. 하드코딩 분산 금지(규칙 9).
4. 임베드 확인은 상위 후보부터 최대 `GUESS_EMBED_CHECKS = 3` 건만 조회한다. 예산을 다 쓰면 **채택하지 않는다** — 확인하지 않은 후보를 재생 가능으로 내려보내지 않는다.
5. 검색 실패(`retry_pending`)와 재생 불가(`unplayable`)를 구분한다. 검색 실패는 `retryable: true` 이고 호출자가 재시도할 수 있다.
6. 결과는 `cache.sqlite` 에 캐시한다. 확정 30일 · 검토 필요 1일 · 검색 실패 10분. 판정 로직이 바뀌면 `ALGORITHM_VERSION` 을 올려 캐시를 무효화한다.

## 수용 기준

- AC1 `GET /videoid?artist=&title=` 이 위 스키마대로 `{best: {videoId}}` 를 반환한다. `tests/test_videoid_resolver.py::test_backend_contract_shape_for_verified`
- AC2 점수 0.6 미만이거나 검색 후보가 없으면 `best` 가 null 이다. `::test_backend_contract_best_is_null_when_unplayable` · `::test_guess_below_threshold_is_unplayable`
- AC3 엄격 검증을 통과한 곡은 `confidence="verified"` 이고 추측 점수와 무관하다. `::test_official_art_track_is_verified`
- AC4 임베드 불가 영상은 확정도 추측도 되지 않는다. `::test_non_embeddable_official_track_is_not_verified` · `::test_embeddable_rejects_unplayable_states` · `::test_guess_skips_candidate_that_cannot_embed`
- AC5 임베드 확인 예산을 넘기면 재생 불가로 판정한다. `::test_guess_stops_after_the_embed_check_budget`
- AC6 `duration` 없이 호출해도 정상 응답이며, 확정은 나오지 않는다. `::test_missing_duration_still_answers`
- AC7 검색 실패는 `retryable: true` 로 재생 불가와 구분된다. `::test_search_failure_is_retryable_not_unplayable` · `::test_backend_contract_marks_search_failure_retryable`
- AC8 `pytest tests/test_videoid_resolver.py` 가 네트워크 없이 통과한다.

## 비범위

- `backend/` 파일 수정 (백엔드 파트 소유). 필요한 변경은 요청으로만 전달한다 — `docs/rules/BACKEND-NOTES.md` 참고
- 후보 없을 때 `video_id` 에 `"none"` 문자열 저장 (S15P21A405-332)
- videoId 일괄 조회의 duration 연동 (S15P21A405-407)
- EC2 배포·운영 전환·쿼터 문서 (스펙 15 AC5)
- `music` 테이블 `video_id` 컬럼 DDL 확정 (`specs/006-playback-videoid/spec.md:109` B-Store)
- 전곡 매핑. 요청 시점 조회만 한다

## 미해결 항목

- **규칙 8 (한글 완전일치)** 이 추측 경로에 적용되지 않는다. 한국 곡에 로마자 유사도 매칭이 걸릴 수 있다. 한글 곡 표본으로 오탐률을 재고 임계값을 따로 두거나 한국 곡은 추측을 끄는 결정이 필요하다.
- **0.6 이라는 값의 근거가 없다.** 200곡 표본 관찰로 고른 값이고 오탐률을 측정하지 않았다. 게이트로 등록해야 한다(규칙 1).
- 임베드 확인이 호출당 최대 3회 추가 네트워크 왕복이다. 백엔드는 읽기 3초 타임아웃이므로 캐시 미스 시 타임아웃이 날 수 있다.
