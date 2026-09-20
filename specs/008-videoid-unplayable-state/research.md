# Phase 0 — 조사: 판정은 지금 누가 내리고 있나

**Date**: 2026-09-18 | **Branch**: `backend/fix/S15P21A405-454-videoid-unplayable-state`

## 1. 값이 만들어지고 읽히는 전 경로

### 쓰기 — 한 곳뿐이다

```
VideoIdMapper.xml:10   UPDATE music SET video_id = #{videoId} WHERE id = #{musicId}
  ← VideoIdWriterAdapter.save
    ← VideoIdEnricher:37   (existingVideoId == null 일 때만 도달)
```

처음 써진 값이 마지막 값이다. 덮어쓰는 질의가 없고, 값이 있으면 다시 묻지 않는다.

### 어댑터가 외부 응답을 무엇으로 바꾸는가 (현재)

```java
if (response == null || response.best() == null) return Optional.empty();
return Optional.ofNullable(response.best().videoId());
```

| 외부 응답 | 어댑터 | 저장 | 클라이언트가 받는 값 |
| --- | --- | --- | --- |
| `best.videoId = "abc12345678"` | `Optional(id)` | 11자 | `"abc12345678"` |
| `best.videoId = "none"` | `Optional("none")` | `'none'` | `"none"` |
| `best` 없음 / 응답 없음 | `empty` | 없음 | `null` |
| 시간 초과·연결 실패 | `empty` | 없음 | `null` |

**핵심**: 2행의 `"none"` 은 백엔드가 만든 값이 아니다. 기존 `videoid_api.py` 가 videoId 자리에 넣어 주는 값이고(S15P21A405-332), 백엔드 자바 코드에는 `"none"` 리터럴이 **하나도 없다**. 판정 주체가 외부에 있다.

### 읽기 — 세 갈래

| 처리 | 경로 | 표시값이 어떻게 되나 |
| --- | --- | --- |
| SQL 에서 행 제외 (`IS DISTINCT FROM 'none'`) | 검색, 대표곡(지도) | 곡이 목록에서 빠진다 |
| enricher 통과 | 곡 상세 중심곡, `POST /api/music/videoid` | 값 그대로 나간다 |
| enricher 없이 row 값 그대로 | 상세 이웃, 주변 탐색, 경로 정거장 | 값 그대로 나간다 |

## 2. 프론트는 이 값을 이미 쓰고 있다 — 결정적 발견

S15P21A405-364 (2026-09-16, 윤주하)가 세 상태를 갈라 놓았다.

```ts
// frontend/src/app/bff/music/[id]/video-id/route.ts
const NOT_FOUND = "none";
const lookup = raw === NOT_FOUND || raw === "" ? "notFound" : raw ? "found" : "unsearched";
```

| 백엔드 값 | FE 상태 | 사용자에게 | 다시 누르면 |
| --- | --- | --- | --- |
| 11자 | `found` | 재생 | — |
| `"none"` | `notFound` | "재생 불가 — 아직 준비 중인 곡이에요. 신고해 주시면 채워 넣을게요" | **재조회 안 함** (`retryable: false`) |
| `null` | `unsearched` | "재생 준비 중 — 잠시 후 다시 눌러 주세요" | 재조회함 |

그리고 프론트는 **`POST /api/music/videoid` 만 videoId 출처로 쓴다.** 곡 상세·주변·경로 응답의 videoId 는 매핑조차 하지 않는다(`lib/backend.ts:242`, `youtube-embed.tsx:130`, `api-endpoints.ts:92`).

**결론 두 가지**
1. 표시값을 `null` 로 바꾸면 **퇴행한다** — 재생 불가 곡이 "잠시 후 다시"가 되고, 재시도 가능 상태라 누를 때마다 조회가 나간다. 그 조회는 영원히 같은 답을 준다
2. "누출"이라 불렀던 세 경로(이웃·주변·경로)는 프론트가 읽지 않아 **사용자 영향이 없다**

## 3. 그래서 진짜 위험은 전환 시점이다

새 서비스는 재생 불가일 때 `best` 를 비워서 보낸다. 지금 어댑터는 그것을 `Optional.empty()` 로 바꾸고, enricher 는 아무것도 저장하지 않는다. 따라서 **조회 주소를 바꾸는 순간**:

- 새로 재생 불가로 판정된 곡에 아무 기록도 남지 않는다 → 프론트는 `unsearched` 로 읽는다
- 사용자는 영원히 "잠시 후 다시 눌러 주세요"를 본다. SONG-04 의 신고 안내가 사라진다
- 그 곡은 누를 때마다 외부 조회를 탄다 — 캐시 미스면 검색 2회 + 영상 확인 최대 3회

기존에 쌓인 `'none'` 행은 계속 동작하므로 **증상이 새 곡에만, 천천히 나타난다.** 눈에 잘 띄지 않는 퇴행이다.

## 4. 설계 선택 — 판정을 어디서 내릴 것인가

### 채택 — 어댑터(`VideoIdApiClient`)에서 번역한다

외부 응답이 "후보 없음"이면 어댑터가 기존과 같은 표시값을 돌려준다. 그 아래는 전부 무변경이다.

```text
best 있음                     → Optional(videoId)        저장: 11자
best 없음 + 재시도 불가        → Optional(표시값)          저장: 표시값   ← 새로 추가되는 분기
best 없음 + 재시도 가능/불명    → empty                    저장: 없음
시간 초과·연결 실패            → empty                    저장: 없음
```

**근거**: 판정의 주체만 외부에서 백엔드로 옮기고 결과는 동일하게 유지한다. `VideoIdLookupPort` 의 반환형이 그대로 쓰이고, enricher·저장·응답·프론트가 손대지 않아도 된다. 전환 전후로 값이 같아 SC-001 이 자동으로 만족된다.
**부작용**: 표시값 문자열의 지식이 자바 쪽에 한 곳 생긴다(어댑터의 상수). SQL 두 곳과 같은 값을 쓴다는 주석으로 묶는다.

### 기각 — `VideoIdLookupPort` 에 판정 타입을 도입한다

`Optional<String>` 대신 `LookupResult(found / notFound / failed)` 같은 타입을 만들어 enricher 가 분기한다. 표현은 정확해지지만 port·어댑터·enricher·테스트가 함께 바뀌고, **바깥에서 보이는 동작은 채택안과 완전히 같다.** 지금 필요 없는 타입이다.

### 기각 — 표시값을 없애고 별도 상태 필드를 응답에 추가한다

계약상 가장 깨끗하다 — 문자열 센티넬이 videoId 타입에서 사라진다. 하지만 백엔드·프론트 동시 변경이고, 프론트는 이미 자기 쪽에서 세 상태를 만들어 쓰고 있어 **사용자 이득이 0이다.** 전환을 막을 이유가 못 된다. FE 합의가 필요한 별건으로 남긴다.

### 기각 — 아무것도 하지 않는다

전환 시점에 3절의 퇴행이 그대로 일어난다.

## 4-1. MR 326 코드 대조 (2026-09-18, 커밋 72e28e9 — `origin/master` 머지됨)

`data/videoid/api.py` 를 읽고 4절의 설계 전제를 확인했다. 결과는 **구조는 맞고 필드명이 다르다**.

| 확인 항목 | 결과 |
| --- | --- |
| 판정 신호 | **`is_unplayable` 은 응답에 없다.** 최상위 `playable`(boolean)·`retryable`(boolean) 로 가른다. `is_unplayable` 은 `music` 칼럼 이름이었다 |
| 실패 표현 | `api.py` 의 `except` 가 예외를 잡아 **HTTP 200 + `retryable: true`** 로 돌려준다. 상태 코드로 가릴 수 없다 |
| 수치 점수 | `best.score`. `confidence == 'best_guess'` 일 때만 채워진다. 우리가 읽지 않으므로 무관 |
| 캐시 | 디스크 SQLite(`cache.sqlite`, `ODY_VIDEOID_CACHE` 로 경로 지정). **재시작에 보존된다.** TTL 확보 30일 / `retry_pending` 10분 / 그 외 1일 |
| DB 접근 | **없다.** psycopg·postgres 참조 0건 — 이 서비스는 `music` 을 건드리지 않는다 |
| 삭제·신고 임계 | **이 MR 에 없다.** 코드도 언급도 0건. 아직 계획 단계다 |
| 미사용 파라미터 | `album`·`isrc`·`releaseYear`·`refresh` 도 받는다. 백엔드는 artist/title/duration 만 보낸다 |
| spec 15 충돌 | DATA 가 자기 spec 에 "추측 금지 위반"을 명시하고 "저장 여부는 백엔드·기획이 결정"이라 적었다 — 우리 결정과 정합 |

**설계 영향**: 판정 조건의 필드명만 바뀐다. 구조(값 / 재생 불가 / 기록 안 함 3분기)는 그대로다.

**철회**: "실패가 5xx 로 오면 응답 필드를 안 읽어도 된다"던 ponytail 지적은 성립하지 않는다. 본문을 읽어야 한다.

## 4-2. 삭제 결정의 영향 (2026-09-18)

재생 불가 행을 주기적으로 삭제하기로 결정되면서 **판정의 정본이 `music.is_unplayable` 로 옮겨간다** — 삭제 배치가 그 값을 보기 때문이다. `video_id = 'none'` 쓰기는 멈추고, 읽기에서만 프론트 호환을 위해 번역한다.

읽기 번역이 필요한 이유: DATA 가 신고 임계로 세우는 플래그에는 표시값이 따라오지 않는다. 쓰기만 이중화하면 그 곡들이 프론트에서 "아직 안 찾아봄"으로 보여 매번 재조회된다.

### 운영 DB 실측으로 확인한 것

| 항목 | 값 |
| --- | --- |
| `music` 전체 | 4,679,505 |
| 판정된 적 있는 곡 | 4,707 (**0.10%**) — 실제 videoId 4,147 + `'none'` 560 |
| `is_unplayable = true` | **0** |
| `music` 를 참조하는 FK | **0개** (6개가 전부 구 테이블 `music_v1` 을 가리킨다) |
| `playlist_item` · `play_history` | 각 **0행** |
| `music_report` · `explore_feedback` | 32행 · 77행 |
| `music_genre` | 63,187행 / 58,259곡 (전체의 **1.2%**) |

- **삭제를 막는 FK 가 없다.** 저장소 DDL(`explore_feedback.sql`)은 `REFERENCES music(id)` 로 적혀 있으나 운영에는 그렇게 걸려 있지 않다. 초안의 "FK 가 막는다"는 지적은 이 실측으로 철회했다.
- **`music` 과 `music_v1` 은 같은 id 가 다른 곡이다** (표본 5개 중 4개 불일치). id 재할당 때 데이터만 옮기고 FK 는 구 테이블에 남았다 — 그 제약들은 실효가 없다. 별건으로 정리가 필요하다.
- **백엔드 실시간 경로는 카탈로그의 0.1%만 본다.** 전량 판정은 DATA 의 별도 채움 작업이 맡는다.

## 5. 미확인 — D-Signal (해소됨, 4-1 참고)

"후보 없음"과 "검색 실패"를 가르는 신호의 이름·위치를 확인하지 못했다. 전달문은 `unplayable` 이면 `best` 가 null 이고 검색 실패는 `retryable: true` 로 구분된다고만 적고 있어, 그 값이 최상위인지 어디인지 알 수 없다. `data/feat/S15P21A405-441-videoid-api-resolver` 가 origin 에 push 되지 않아 코드로 볼 수 없다.

**대응**: 신호를 읽지 못하면 **기록하지 않는다**(FR-003). 잘못 굳히면 곡 하나가 영구히 재생 불가가 되고 되돌릴 경로가 없지만, 안 굳히면 조회 한 번이 낭비될 뿐이다. 필드가 확인되면 어댑터의 조건 한 줄만 채운다.

## 6. 조사 중 확인했으나 범위 밖인 것

- **대표곡(지도) 응답에 videoId 가 없다.** `MajorTrackMapper` 는 표시값을 필터에만 쓰고 `video_id` 를 select 하지 않는다. spec 006 FR-001 과의 공백이지만 원인이 다르다
- **이미 쌓인 표시값 행의 재검증(백필).** 새 resolver 의 판정이 더 엄격하므로 기존 값 일부는 다시 볼 가치가 있다. 전환 후 판단한다
- **유사도 추측 판정의 고착.** spec 의 "알려진 한계" 참고. 되돌리려면 판정 라벨 칼럼(BE4 영역)이 필요하다
