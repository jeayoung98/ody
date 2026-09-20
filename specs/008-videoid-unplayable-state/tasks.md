---
description: "Task list for 재생 불가 판정을 백엔드가 직접 기록한다"
---

# Tasks: 재생 불가 판정을 백엔드가 직접 기록한다

**Input**: Design documents from `/specs/008-videoid-unplayable-state/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 명세가 회귀 검증을 요구한다(spec FR-002·FR-003, 헌법 III). 테스트 과제를 포함한다.

> **⚠️ 이 목록은 구현 이후에 작성됐다.** `/speckit-tasks` 를 건너뛰고 plan.md 의 파일 목록을 따라 바로
> 구현했고, 그 결과를 되짚어 과제로 정리했다. 완료 표시(`[X]`)는 실제 코드와 `./gradlew test` 통과로
> 확인한 것이다. `/speckit-analyze` 가 spec·plan 과 대조할 수 있도록 남긴다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 의존 없음)
- **[Story]**: US1 / US2 / US3

## Path Conventions

웹 앱 구조 — 백엔드는 `backend/src/main/java/...`, 테스트는 `backend/src/test/java/...`

---

## Phase 1: Setup (선행 조건)

**Purpose**: 코드가 배포되기 전에 저장 계층의 판정 표시를 일치시킨다

- [X] T001 운영 DB 백필 실행 — `UPDATE music SET is_unplayable = true WHERE video_id = 'none'` (560행). **사람이 직접 실행한다** (운영 쓰기). 실행 전후 `SELECT count(*) FILTER (WHERE is_unplayable), count(*) FILTER (WHERE video_id = 'none') FROM music` 가 `0 | 560` → `560 | 560`

**⚠️ T001 없이 T014·T015 가 배포되면 560곡이 검색·지도에 되살아난다 (spec SC-004 위반)**

---

## Phase 2: Foundational (모든 스토리의 선행)

**Purpose**: 판정 값의 표현과 외부 응답 계약 — 세 스토리가 전부 이 둘을 쓴다

- [X] T002 `VideoIds` 추가 — 재생 불가 상수와 플래그→응답 값 번역, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIds.java`
- [X] T003 `VideoIdApiResponse` 에 `playable`·`retryable` 추가 및 `unplayable()` 판정 메서드, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdApiResponse.java`

**Checkpoint**: 판정을 표현할 수단이 생겼다. 스토리 구현 가능

---

## Phase 3: User Story 1 - 재생할 수 없는 곡은 그 사실을 알려 준다 (Priority: P1) 🎯 MVP

**Goal**: 후보를 못 찾은 곡의 판정을 `music.is_unplayable` 에 남기고, 그 상태가 클라이언트까지 같은 값으로 전달된다

**Independent Test**: 후보 없는 곡을 두 번 조회해 ① 플래그가 서고 ② 두 번째 조회가 외부 호출 없이 같은 답을 주는지 본다

### Tests for User Story 1

- [X] T004 [P] [US1] 후보 있음 → videoId 반환 테스트, `backend/src/test/java/com/ssafy/backend/music/videoid/VideoIdApiClientTests.java`
- [X] T005 [P] [US1] 후보 없음 + 재시도 불가 → 재생 불가 반환 테스트, 같은 파일
- [X] T006 [P] [US1] 재생 불가 판정 시 `markUnplayable` 호출하고 `save` 는 호출하지 않는 테스트, `backend/src/test/java/com/ssafy/backend/music/videoid/VideoIdEnricherTests.java`

### Implementation for User Story 1

- [X] T007 [US1] `VideoIdApiClient.lookup` 이 응답을 판정으로 번역 — 후보 있음 / 재생 불가 / 빈 값, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdApiClient.java`
- [X] T008 [P] [US1] `VideoIdWriterPort.markUnplayable` 선언, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdWriterPort.java`
- [X] T009 [P] [US1] `VideoIdMapper.markUnplayable` 선언, `backend/src/main/java/com/ssafy/backend/music/mapper/VideoIdMapper.java`
- [X] T010 [US1] `markUnplayable` UPDATE 문 추가 (`video_id` 는 건드리지 않는다), `backend/src/main/resources/mapper/music/VideoIdMapper.xml`
- [X] T011 [US1] `VideoIdWriterAdapter.markUnplayable` 구현 (T008·T009·T010 의존), `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdWriterAdapter.java`
- [X] T012 [US1] `VideoIdEnricher` 가 판정에 따라 쓰기를 가른다 — 재생 불가면 플래그, 그 외는 videoId (T011 의존), `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdEnricher.java`
- [X] T013 [P] [US1] `MusicDetailRow.unplayable` 필드 추가, `backend/src/main/java/com/ssafy/backend/music/dto/MusicDetailRow.java`
- [X] T014 [US1] `findById`·`findByIds` 에 `m.is_unplayable AS unplayable` 추가 (T013 의존), `backend/src/main/resources/mapper/music/MusicDetailMapper.xml`
- [X] T015 [US1] 읽기 번역 3곳 — `toDetail`·`findSummariesByIds` (T013 의존), `backend/src/main/java/com/ssafy/backend/music/detail/MusicDetailReaderAdapter.java`
- [X] T016 [P] [US1] 읽기 번역 — 경로 정거장 (T013 의존), `backend/src/main/java/com/ssafy/backend/music/journey/JourneyTrackReaderAdapter.java`

**Checkpoint**: 판정이 기록되고 다섯 경로가 같은 값을 낸다

---

## Phase 4: User Story 2 - 일시적 실패를 영구 판정으로 굳히지 않는다 (Priority: P1)

**Goal**: 시간 초과·검색 실패·판정 불명이 재생 불가로 기록되지 않는다

**Independent Test**: 조회가 실패하도록 두고 한 번 조회한 뒤 아무것도 기록되지 않았는지 본다

### Tests for User Story 2

- [X] T017 [P] [US2] `retryable: true` → 빈 값 테스트, `backend/src/test/java/com/ssafy/backend/music/videoid/VideoIdApiClientTests.java`
- [X] T018 [P] [US2] HTTP 200 안의 실패(`retry_pending`) → 빈 값 테스트, 같은 파일
- [X] T019 [P] [US2] 판정 필드 누락 → 빈 값 테스트 (FR-003), 같은 파일
- [X] T020 [P] [US2] HTTP 400 → 빈 값 테스트, 같은 파일
- [X] T021 [P] [US2] 모르는 필드가 섞여도 판정 유지 테스트 (FR-007), 같은 파일

### Implementation for User Story 2

- [X] T022 [US2] `unplayable()` 이 `playable`·`retryable` **둘 다 명시적 거짓**일 때만 참 — 하나라도 못 읽으면 판정하지 않는다, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdApiResponse.java`

**Checkpoint**: 실패가 영구 판정으로 굳지 않는다

---

## Phase 4-1: FR-006 회귀 방지

**Purpose**: "판정 라벨로 저장을 가르지 않는다"는 정책 결정을 테스트로 고정한다 (analyze U2)

- [X] T022a `verified` 와 `best_guess` 가 같은 결과를 내는지 고정하는 테스트 — 라벨 분기가 들어오면 깨진다, `backend/src/test/java/com/ssafy/backend/music/videoid/VideoIdApiClientTests.java`

---

## Phase 5: User Story 3 - 이미 판정된 곡을 다시 찾지 않는다 (Priority: P2)

**Goal**: 판정이 끝난 곡에 외부 조회가 나가지 않는다

**Independent Test**: 판정된 곡을 연속 조회하고 외부 호출이 0인지 본다

### Tests for User Story 3

- [X] T023 [P] [US3] 재생 불가로 판정된 곡은 조회·저장 port 를 건드리지 않는 테스트, `backend/src/test/java/com/ssafy/backend/music/videoid/VideoIdEnricherTests.java`

### Implementation for User Story 3

- [X] T024 [US3] 별도 구현 없음 — T015·T016 의 읽기 번역이 `existingVideoId` 를 재생 불가 값으로 넘겨 `VideoIdEnricher` 의 기존 단축 경로가 그대로 동작한다. javadoc 에 근거 명시, `backend/src/main/java/com/ssafy/backend/music/videoid/VideoIdEnricher.java`

**Checkpoint**: 세 스토리 모두 동작

---

## Phase 6: 목록 제외 규칙 전환 (FR-005)

**Purpose**: 검색·대표곡이 정본인 플래그를 읽는다

- [X] T025 [P] 검색 4단계 제외 조건을 `NOT m.is_unplayable` 로, 프래그먼트 이름 `videoIdNotNone` → `playableOnly` (10곳), `backend/src/main/resources/mapper/music/MusicSearchMapper.xml`
- [X] T026 [P] 대표곡 2곳 제외 조건 전환, `backend/src/main/resources/mapper/music/MajorTrackMapper.xml`
- [X] T027 필터 회귀 테스트의 조건 정규식 갱신 (T025 의존), `backend/src/test/java/com/ssafy/backend/music/MusicSearchMapperVideoIdFilterTests.java`

---

## Phase 7: Polish & 검증

- [X] T028 `./gradlew test` 통과 — 신규 7건 + 기존 확장 포함 전부 통과
- [X] T029 `./gradlew build` 통과
- [ ] T030 전환 리허설 — 새 resolver 를 로컬에 띄우고 `ody.videoid.base-url` 을 돌린 뒤 플래그가 계속 늘어나는지 확인 (quickstart §3)
- [ ] T031 프론트 문구 확인 — 재생 불가 곡에 "재생 불가 / 아직 준비 중인 곡이에요" 가 그대로 나오는지 (quickstart §5)
- [ ] T032 커밋 및 MR 작성 (target `backend/dev`, 제목에 `[S15P21A405-454]`)

---

## Phase 8: 차단된 항목

- [ ] T033 **[BLOCKED]** FR-008 — 삭제된 곡을 참조했을 때의 응답 설계. 프론트 회신 대기(A/B/C 안). 삭제 배치 가동 전까지는 동작에 영향 없음
- [ ] T034 상대 파트 전달 4건 — FE 2(FR-008·`genres`), 기획 1(spec 006 FR-004 갱신), DATA 1(duration 이미 반영됨)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 은 배포 전에만 끝나면 된다. 코드 작업을 막지 않는다
- **Foundational (Phase 2)**: 모든 스토리를 막는다
- **US1 (Phase 3)**: Foundational 이후. 이 기능의 MVP
- **US2 (Phase 4)**: Foundational 이후. US1 과 같은 파일(`VideoIdApiResponse`)을 건드리므로 순차
- **US3 (Phase 5)**: US1 의 T015·T016 에 의존 (읽기 번역이 있어야 단축 경로가 동작)
- **Phase 6**: Foundational 이후 독립. 단 **배포는 T001 이후**
- **Phase 7**: 위 전부 완료 후

### Within User Story 1

T007 → T008·T009·T010 → T011 → T012, 그리고 T013 → T014·T015·T016

### Parallel Opportunities

- T004·T005·T006 (테스트, 서로 다른 관심사)
- T008·T009 (선언만, 다른 파일)
- T013 완료 후 T014·T015·T016 은 서로 다른 파일이라 병렬
- T017~T021 (전부 같은 테스트 파일이라 실제로는 한 번에 작성)
- T025·T026 (다른 매퍼)

---

## Implementation Strategy

### MVP (User Story 1)

Phase 2 → Phase 3 까지가 최소 동작이다. 판정이 기록되고 다섯 경로가 같은 값을 낸다. 다만 **US2 없이 배포하면 안 된다** — 일시 실패가 영구 판정으로 굳어 되돌릴 수 없다.

### 실제 배포 단위

Phase 2~6 을 한 번에 낸다. 스토리를 쪼개 배포할 이유가 없다 — 변경이 작고, US2 를 빼면 위험하다.

### 배포 순서

1. T001 백필 (사람)
2. Phase 2~7 배포
3. `ody.videoid.base-url` 전환 (인프라)

---

## Notes

- `[P]` = 다른 파일, 의존 없음
- 완료 표시는 실제 코드와 테스트 통과로 확인한 것이다
- T001 과 T030·T031 은 운영·수동 작업이라 자동 검증 대상이 아니다
