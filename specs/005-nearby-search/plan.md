# Implementation Plan: 기준점 주변 곡 탐색 (Nearby Search)

**Branch**: `backend/feat/S15P21A405-59-nearby-endpoint` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-nearby-search/spec.md`

**Jira**: S15P21A405-59 (MAP-10)

## Summary

기준점(곡 또는 16차원 좌표)에서 가까운 곡 최대 10곡을 돌려주는 조회 API 를 추가한다.
최근접 후보 40곡을 pgvector HNSW 로 뽑아 **애플리케이션에서** 선정 규칙(같은 녹음 접기·아티스트 3곡 상한·길이 범위)을 적용해 10곡을 남기고, 마지막 이웃이 멀면 `lowSimilarity` 를 함께 알린다.

**이 기능의 핵심은 새 엔드포인트가 아니라 선정 규칙을 한 곳으로 모으는 것이다.** 곡 상세(003)의 `neighbors` 도 같은 계층을 쓰도록 바꿔 두 진입점이 같은 곡에 같은 목록을 준다(FR-023 · 003 FR-014 · SC-006).

조회·거리·인덱스는 004 가 만든 `NearestTrackReader` 경계 뒤에 이미 있다. 이번 작업은 **그 위에 선정 계층과 진입점을 얹는 것**이고, 새 SQL 이나 새 인덱스를 만들지 않는다.

## Technical Context

**Language/Version**: Java 17 / Spring Boot 4.1.1 (스타터·테스트 슬라이스 패키지명이 3.x 와 다르다 — `spring-boot-starter-webmvc`, `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`, `@MockitoBean`)

**Primary Dependencies**: MyBatis, PostgreSQL 17.11 + pgvector(HNSW, `vector_l2_ops`), Micrometer

**Storage**: `music` 테이블 6,624,399행. `location VECTOR(16)` + HNSW 인덱스. 운영에 이미 적재·인덱싱 완료(2026-09-13 실측)

**Testing**: JUnit 5 + Mockito. 컨트롤러는 `@WebMvcTest` 슬라이스 + 매퍼 `@MockitoBean`(003 선례), 선정 로직은 순수 유닛

**Target Platform**: Linux 서버 (app-node, Docker)

**Project Type**: web service (backend 단일 Gradle 프로젝트)

**Performance Goals**: 주변 곡 목록 요청 p95 **1초 이내**(SC-002, 요구사항 §6 "유사곡 검색 1초")

**Constraints**: 조회 전용(쓰기 0건). 서버 측 탐색 세션 없음. 좌표·모델 재계산 금지. 선정 임계값을 코드에 박지 않음

**Scale/Scope**: 엔드포인트 1개 신설 + 기존 엔드포인트 1개(`/api/music/detail`) 동작 변경. 신규 클래스 5~6개

## Constitution Check

*GATE: Phase 0 전 통과해야 한다. Phase 1 설계 후 재확인.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I 명세 우선 | ✅ | spec.md 확정(Clarifications 미결 0). 003 명세도 개정 완료(FR-014·SC-006) |
| II 계약 우선 | ⚠️ → ✅ | api-spec 에 이 엔드포인트가 없다. **Phase 1 에서 `contracts/music-nearby.md` 를 먼저 쓰고 구현 전에 §3.5 로 반영**한다. 003 §3.2 도 함께 갱신 |
| III 완료 전 검증 | ✅ | `./gradlew test`·`build` 통과가 완료 조건. 통합 검증은 실 DB 필요분을 미실행으로 구분해 기록 |
| IV 데이터 재현성 | N/A | 데이터 산출물을 만들지 않는다 |
| V 좌표 안정성 | ✅ | 좌표를 읽기만 한다. 임계값은 `ServingRules` 가 번들 버전에 묶어 들고 있다(FR-022) |
| VI 탐색 일관성 | ✅ | **이 기능의 본체다.** 선정 규칙 단일 구현(FR-023), 두 진입점 결과 일치(SC-006), 기준점 보존(FR-011) |
| VII 실험 격리 | ✅ | 서빙 기준선 `v2.1-pca16` 만 읽는다 |
| VIII 관측 가능성 | ✅ | 요청량·지연·오류율 + **규칙 통과 10곡 미달률**(SC-008) 지표를 Phase 1 에서 정의 |
| IX 암묵적 가정 금지 | ✅ | research.md 가 결정마다 근거를 달았고, 확인 못 한 4건을 따로 남겼다 |
| X 아키텍처 경계 | ⚠️ 주의 | 조회·거리·인덱스는 BE4 경계(`NearestTrackReader` 뒤). BE2 는 선정 규칙·응답만 소유. **`SecurityConfig`(BE1)는 건드리지 않는다**(R6) |

**게이트 통과.** II 는 Phase 1 산출물로 해소되며, X 는 아래 "경계에서 하지 않을 일"로 고정한다.

### 경계에서 하지 않을 일

- 새 SQL·새 인덱스를 만들지 않는다 — `NearestTrackReader` 를 호출한다
- 선정 조건을 질의에 넣지 않는다 — pgvector 0.7.0 은 `WHERE` 를 인덱스 뒤에 적용해 `LIMIT` 보다 적게 준다
- 질의 좌표를 서브쿼리로 넘기지 않는다 — `InitPlan` 이 되어 recall 0.0000 으로 **조용히 틀린다**
- 임계값을 Java 상수로 박지 않는다 — `ServingRules` 에서 읽는다
- `SecurityConfig`·`GlobalExceptionHandler` 를 고치지 않는다 — BE1 소유

## Project Structure

### Documentation (this feature)

```text
specs/005-nearby-search/
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── music-nearby.md  # Phase 1
├── checklists/
│   └── requirements.md  # spec 품질 체크리스트 (16/16)
└── tasks.md             # /speckit-tasks 산출물 (이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
backend/src/main/java/com/ssafy/backend/music/
├── controller/
│   └── MusicController.java              # 수정 — GET /nearby 핸들러 추가
├── dto/
│   ├── NearbyResponse.java               # 신설 — center + neighbors + lowSimilarity
│   ├── NeighborTrack.java                # 재사용 (MusicSummary + distance)
│   └── Location.java                     # 재사용
├── service/
│   └── NearbyService.java                # 신설 — 기준점 해석 → 후보 → 선정 → 조립
├── retrieval/
│   ├── NearestTrackReader.java           # 재사용 (좌표 기반 port, 004 신설)
│   ├── NearestTrackReaderAdapter.java    # 재사용 (raiseEfSearch 포함)
│   ├── ServingRules.java                 # 재사용 (tauDup·artistCap·tauFar·길이)
│   ├── TrackCandidate.java               # 재사용
│   ├── NeighborSelection.java            # 신설 — 공용 선정 계층 (이 기능의 본체)
│   └── SameRecording.java                # 이동 — music/journey/ 에서 옮겨오고 가시성 상향
├── detail/
│   └── MusicDetailReaderAdapter.java     # 수정 — findNeighbors 가 공용 계층을 쓰도록
├── mapper/
│   ├── NearestTrackMapper.java           # 재사용
│   └── MusicDetailMapper.java            # 수정 — findNearest 호출부 소멸
└── journey/
    ├── LayerCandidates.java              # 수정 — SameRecording import 경로만
    └── SameRecording.java                # 삭제 (retrieval 로 이동)

backend/src/test/java/com/ssafy/backend/music/
├── NeighborSelectionTests.java           # 신설 — 규칙별 유닛 (조회 mock 불필요)
├── NearbyServiceTests.java               # 신설 — 조립·기준점 해석·오류 분기
├── NearbyControllerTests.java            # 신설 — 요청 검증·응답 계약
└── MusicDetailServiceTests.java          # 수정 — 통일된 규칙 기대값으로

docs/api-spec.md                          # 수정 — §3.5 신설, §3.2 갱신
```

**Structure Decision**: 기존 `backend/` 단일 Gradle 프로젝트의 `music` 도메인 안에서 해결한다. 새 모듈·새 패키지를 만들지 않는다.

선정 계층을 **`music/retrieval/`** 에 두는 것이 이 구조의 핵심 판단이다. 그 패키지는 이미 조회 port·임계값·후보 타입을 담은 중립 지대이고, 주변 탐색(005)·곡 상세(003)·여정(004) 셋 중 어느 것에도 속하지 않는다. `music/nearby/` 같은 전용 패키지를 만들면 003 이 남의 기능 패키지를 참조하는 모양이 된다.

## 처리 흐름

```text
GET /api/music/nearby?id=      또는  ?pc1=..&pc16=..
  │
  ├─ 1. 요청 검증 — id 와 좌표 중 정확히 하나 (둘 다/둘 다 아님 → 400)
  │
  ├─ 2. 기준점 해석
  │      곡 기준  → findLocationText(id) → 좌표 (없는 곡 → 404 MUSIC_NOT_FOUND)
  │      좌표 기준 → 받은 값 그대로 (보정하지 않는다, FR-011)
  │
  ├─ 3. 후보 확보 — NearestTrackReader.findNearest(vec, 40)
  │                  (ef_search 기본값 40 과 같아 상향 불필요)
  │
  ├─ 4. 선정 — NeighborSelection.select(후보, 기준점, rules, 제외할 곡 id)
  │      거리 오름차순으로 훑으며:
  │        자기 자신 / dist < tauDup / 이미 담은 (artist,title) 키
  │        / 기준점 곡과 같은 키 / 같은 아티스트 artistCap 초과
  │        / duration 범위 밖
  │      → 10곡 차면 중단, (distance, id) 안정 정렬
  │
  ├─ 5. 상세 채우기 — 확정된 10곡에만 앨범·장르 조인, youtubeUrl 생성
  │
  └─ 6. 조립 — center + neighbors + lowSimilarity(마지막 거리 > tauFar)
```

곡 상세(003)는 2~5 를 **같은 함수로** 지나간다. 다른 것은 진입점과 응답 껍데기뿐이다.

## 오류 매핑

| 상황 | 응답 |
| --- | --- |
| `id` 와 좌표를 둘 다 줌 / 둘 다 안 줌 | 400 `INVALID_INPUT` |
| `id` 가 0 이하·비정수 | 400 `INVALID_INPUT` |
| 좌표가 16개가 아니거나 숫자가 아님 | 400 `INVALID_INPUT` |
| `id` 에 해당하는 곡 없음 | 404 `MUSIC_NOT_FOUND` |
| 규칙 통과 곡 0곡 | **200** + 빈 배열 + `lowSimilarity: true` |
| 조회 port 빈 부재 | 500 (미구현을 드러낸다, 부분 결과 금지) |
| 내부 실패 | 500 `INTERNAL_SERVER_ERROR` |

인증 실패(401)는 `SecurityConfig` 가 켜진 뒤에 성립한다(R6).

## 관측 (헌법 VIII)

| 지표 | 용도 |
| --- | --- |
| `http.server.requests` (기존 히스토그램 재사용) | 요청량·지연·오류율. SC-002 의 p95 확인 |
| 조회 구간 `Timer` | 후보 조회와 선정·조립을 나눠 본다. 콜드 350ms 가 어디서 나는지 구분 |
| **규칙 통과 10곡 미달 카운터** | SC-008. 실측에서 700곡 중 0건이었다. 운영에서 0 이 아니면 후보 40 을 재검토한다 |

로그에 곡 제목·사용자 식별자를 남기지 않는다. 거리 값을 지표 태그로 쓰지 않는다(카디널리티).

## Complexity Tracking

> Constitution Check 위반 없음. 아래는 위반이 아니라 **의도적으로 지는 비용**이다.

| 선택 | 왜 | 기각한 더 단순한 방법 |
| --- | --- | --- |
| 003 의 이웃 조회 경로를 통째로 교체 | SC-006(두 진입점 100% 일치). 003 이 자기 SQL 로 자르는 한 일치는 우연이다 | 003 을 그대로 두기 — 같은 곡에 두 화면이 다른 목록을 준다(D-003 에서 기각됨) |
| 후보 40 (필요한 10의 4배) | 2026-09-13 실측 최악 25위의 1.6배 여유. pgvector 가 `WHERE` 를 인덱스 뒤에 적용해 질의로는 못 거른다 | 후보 10 — 절반이 10곡을 못 채운다(실측 중앙값 11) / 후보 100 — 필요량의 4배, `ef_search` 상향 비용 |
| 상세 필드를 2단계로 채움 | 후보 40 에 장르 조인을 걸면 그 비용이 그대로 지연이 된다 | 한 번에 조인 — 후보 4배에 조인 4배 |
| `SameRecording` 패키지 이동 | 003·005 가 써야 하는데 지금은 `journey` 의 package-private | 복붙 — 같은 규칙이 두 벌이 되어 갈라진다(FR-023 위반) |
