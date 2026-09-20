# Implementation Plan: 재생 불가 판정을 백엔드가 직접 기록한다

**Branch**: `backend/fix/S15P21A405-454-videoid-unplayable-state` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-videoid-unplayable-state/spec.md`

## Summary

"찾아봤지만 없음"이라는 판정은 지금 **외부 서비스가 내려 준다** — 후보가 없으면 videoId 자리에 표시값을 넣어 보내고 백엔드는 그대로 저장한다. 새 서비스(MR 326)는 그 자리를 비워 보내므로 전환과 동시에 판정이 사라진다.

**판정을 백엔드가 내리고 `music.is_unplayable` 에 기록한다.** 프론트가 보는 값은 읽기 시점에 번역해 그대로 유지한다.

## Technical Context

**Language/Version**: Java 17 (`sourceCompatibility = '17'`)

**Primary Dependencies**: Spring Boot 4.1.1, `RestClient`, MyBatis 4.1.0

**Storage**: PostgreSQL. `music.is_unplayable`(boolean NOT NULL DEFAULT false) — **이미 존재**하므로 스키마 변경 없음. 운영 실측 값 0행

**Testing**: JUnit 5 + Mockito + AssertJ. HTTP 어댑터는 `MockRestServiceServer`(spring-test, `spring-boot-starter-webmvc-test` 포함). 불가하면 JDK `HttpServer` 스텁

**Target Platform**: Linux 서버(Docker) 위 Spring Boot 단일 백엔드

**Project Type**: 웹 서비스 (`backend/` + `frontend/`)

**Performance Goals**: 판정된 곡의 외부 호출을 0으로 유지한다

**Constraints**: 외부 조회는 연결 2초·읽기 3초에서 끊긴다. **실패도 HTTP 200 으로 온다** — `api.py` 가 예외를 잡아 `retryable: true` 로 돌려주므로 상태 코드로 가릴 수 없고 본문을 읽어야 한다

**Scale/Scope**: 변경 파일 17개(신규 2). 마이그레이션 없음, 프론트 변경 없음

### 외부 응답 계약 (MR 326 `api.py` 확인)

```json
{ "best": { "videoId": "...", "youtubeUrl": "...", "confidence": "verified|best_guess", "score": null },
  "playable": true, "status": "...", "reason": "...",
  "threshold": 0.6, "retryable": false, "cacheHit": true, "checkedAt": "..." }
```

`is_unplayable` 은 **응답에 없다** — `music` 테이블 칼럼 이름이다. 판정은 최상위 `playable`·`retryable` 로 가른다.

```java
best 있음                              → Optional.of(videoId)   기록: videoId
best 없음 && !playable && !retryable   → 재생 불가               기록: is_unplayable = true
그 외 (retryable, 판정 불명, 예외)      → Optional.empty()       기록: 없음
```

## Constitution Check

*GATE: Phase 0 전 통과. Phase 1 설계 후 재확인 — 동일, 위반 없음.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I. 명세 우선 | 통과 | 외부 관찰 가능한 동작(재생 불가 안내)의 유지가 걸려 있어 명세를 먼저 썼다 |
| II. 계약 우선 | 통과 | 프론트 계약을 **바꾸지 않는 것**이 설계의 핵심이다. [contracts/videoid-response.md](./contracts/videoid-response.md) 에 고정했다 |
| III. 완료 전 검증 | 통과 예정 | 판정 3분기 + 백필 순서 검증. `./gradlew test` 통과가 완료 조건 |
| VIII. 관측 가능성 | 통과 | 아래 "확인할 지표" |
| IX. 암묵적 가정 금지 | 통과 | 응답 필드는 MR 326 코드로 확인했고, 칼럼 존재는 운영 DB 로 확인했다. 추측한 필드명에 기대지 않는다 |
| X. 아키텍처 경계 | 통과 | 변경은 `backend/` 안, BE2(Discovery) 범위. `data/`·`frontend/` 는 읽기만 했다 |

**확인할 지표**:
- 전환 전후로 `is_unplayable = true` 행 수가 **계속 늘어나는지** — 멈추면 판정이 사라진 것이다
- 판정된 곡 조회 시 `[VideoId] 실시간 매핑 완료` 로그가 찍히지 않는 것
- 새 지표·미터는 넣지 않는다

## Project Structure

### Documentation (this feature)

```text
specs/008-videoid-unplayable-state/
├── plan.md · spec.md · research.md · data-model.md · quickstart.md
├── contracts/videoid-response.md
├── checklists/requirements.md
└── tasks.md                       # /speckit-tasks 산출물 (아직 없음)
```

### Source Code (repository root)

```text
backend/src/main/java/com/ssafy/backend/music/
├── videoid/
│   ├── VideoIds.java                # 신규 — 재생 불가 상수 + 플래그→응답 값 번역
│   ├── VideoIdApiResponse.java      # playable·retryable 읽기, unplayable() 판정
│   ├── VideoIdApiClient.java        # 응답을 판정으로 번역
│   ├── VideoIdEnricher.java         # 판정에 따라 쓰기를 가른다
│   ├── VideoIdWriterPort.java       # markUnplayable 선언
│   └── VideoIdWriterAdapter.java    # markUnplayable 구현
├── mapper/VideoIdMapper.java        # markUnplayable 선언
├── dto/MusicDetailRow.java          # unplayable 필드
├── detail/MusicDetailReaderAdapter.java   # 번역 2곳 (toDetail · findSummariesByIds)
└── journey/JourneyTrackReaderAdapter.java # 번역 1곳

backend/src/main/resources/mapper/music/
├── VideoIdMapper.xml                # markUnplayable UPDATE
├── MusicDetailMapper.xml            # is_unplayable AS unplayable (select 2곳)
├── MusicSearchMapper.xml            # 제외 조건 전환 + 프래그먼트 rename (10곳)
└── MajorTrackMapper.xml             # 제외 조건 전환 (2곳)

backend/src/test/java/com/ssafy/backend/music/
├── videoid/VideoIdApiClientTests.java              # 신규 — 판정 분기·200 안의 실패·라벨 무차등
├── videoid/VideoIdEnricherTests.java               # 확장 — 플래그 기록, 재조회 생략
└── MusicSearchMapperVideoIdFilterTests.java        # 조건 정규식 갱신
```

**총 17개** (main 11 + 매퍼 XML 은 위 11에 포함, test 3, 그중 신규 2 — `VideoIds.java`·`VideoIdApiClientTests.java`).

**Structure Decision**: 기존 레이아웃 그대로, 새 패키지 없음. 새 파일은 둘뿐이다. **삭제 결정 때문에 손대는 파일이 2개에서 17개로 늘었다** — 판정의 정본이 다른 칼럼으로 옮겨가면서 쓰기·읽기·필터 세 방향이 모두 그 칼럼을 봐야 하기 때문이다.

`VideoIdLookupPort` 의 시그니처(`Optional<String>`)는 건드리지 않았다. `"none"` 이 이미 응답 계약이라 그것을 앱 안의 "재생 불가" 표현으로도 쓰면 세 결과가 두 값으로 표현된다 — 결과 타입을 새로 만들 이유가 없었다.

## 실행 순서

1. **백필** — `UPDATE music SET is_unplayable = true WHERE video_id = 'none'` (560행, 사람이 실행)
2. 코드 변경 + 테스트
3. 배포
4. `ody.videoid.base-url` 을 새 서비스로 전환 (인프라)

1을 건너뛰고 3까지 가면 560곡이 검색·지도에 되살아난다(SC-004 위반).

## 변경하지 않는 것

| 대상 | 이유 |
| --- | --- |
| 프론트 | `found`/`notFound`/`unsearched` 세 상태가 그대로 동작한다. 작업 없음 |
| 응답 DTO·컨트롤러 | 필드도 값 규약도 그대로 |
| `VideoIdLookupPort` 시그니처 | 결과는 여전히 "값 또는 없음" 두 가지다 |
| `music` 스키마 | 칼럼이 이미 있다 |
| `album`·`releaseYear` 전송 | 정확도는 오르지만 이 이슈의 문제가 아니다 — 별도 이슈 |

## 이전 계획에서 철회한 것

- **"표시값이 videoId 로 샌다"를 버그로 본 초안** — 그 값은 프론트가 의존하는 계약이다(S15P21A405-364). `null` 로 바꾸면 재생 불가 곡이 "잠시 후 다시"로 퇴행하고 클릭마다 재조회가 나간다.
- **"실패가 5xx 로 오면 응답 필드를 안 읽어도 된다"는 ponytail 지적** — `api.py` 가 실패를 200 + `retryable: true` 로 돌려준다. 본문을 읽어야 한다.
- **FK 가 삭제를 막는다는 지적** — 운영 실측으로 `music` 참조 FK 는 0개다(6개가 전부 구 테이블 `music_v1` 을 가리킨다).

## Complexity Tracking

위반 없음.
