# Feature Specification: 노래 상세 조회 (Nearby 포함)

**Feature Branch**: `003-music-detail`

**Created**: 2026-09-09

**Status**: Draft — master 인프라 기준 (002-music-search와 동일 공통 레이어 채택)

**Input**: 인증된 사용자가 곡 ID로 상세 정보를 조회한다. `GET /music/detail`은 곡의 상세 필드(MusicDetail)와 임베딩 공간 최근접 10곡(neighbors, distance 포함)을 함께 반환한다(정본 §3.2, 요구사항 SONG-상세 / Nearby). 공통 응답·에러 계약은 **master에 통합된 실제 공통 레이어**(backend `common.ApiResponse`/`GlobalErrorCode` 등)를 기준으로 하고, BE2 담당(Discovery)의 주변곡 규칙을 정의한다.

## Clarifications

### Session 2026-09-09

- Q: neighbors 정렬의 동률(distance 같음) tie-break를 무엇으로 할까? → A: `distance` 오름차순, 동률 시 `id` 오름차순. 같은 곡·같은 baseline에서 재요청 시 순서가 안정적이어야 한다(결정성). *(clarify 확정)*
- Q: `GET /music/detail`은 순수 조회인가, 재생 기록 부수효과(playCnt 증가·user.lastMusic 갱신)를 갖나? → A: **순수 조회(부수효과 없음)**. `playCnt`·`lastMusic` 갱신은 별도 재생/기록 경로(BE3 Realtime 또는 Core) 책임이며, 상세 조회는 어떤 도메인에도 쓰기를 하지 않는다(헌법 X 경계). *(clarify 확정)*
- Q: 거리 척도와 최근접 계산(KNN) 실행 주체는? → A: 거리 척도는 서빙 baseline `v2.1-pca16`에 귀속되며, KNN **실행**은 BE4 조회 port에 위임한다(헌법 X). BE2는 port 계약과 응답 조립을 소유. 계산식(예: 16차원 L2) 자체는 BE4 확정 대상(B-D).
- 결정: `MUSIC_NOT_FOUND`(404)는 master `GlobalErrorCode`에 없다(현재 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`만 존재). 음악 도메인 에러는 BE2 소유이므로 **BE2가 도메인 `ErrorCode`(예: `MusicErrorCode`)로 정의**하여 공통 핸들러에 연동한다. 이는 타 팀 블로커가 아니라 BE2 범위 내 작업이며, 정본 §0.5의 `MUSIC_NOT_FOUND`와 정합한다.
- 인증(401): master에 Core 인증·시큐리티 미구현, 401 코드도 `GlobalErrorCode`에 없음 → **B-A 블로커**(002와 공유), 코드값은 Core 확정 대기.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 곡 상세 정보 조회 (Priority: P1)

사용자가 곡을 선택하면, 그 곡의 상세 정보(제목·아티스트·앨범·장르·BPM·재생시간·재생수·좌표 등)를 받아 상세 화면을 구성하고 재생 가능 여부를 판단할 수 있다.

**Why this priority**: 곡 하나를 지목해 상세를 여는 것은 지도·검색·플레이리스트 모든 진입점이 공유하는 기본 조회다. 이 스토리 하나만으로 상세 화면의 가치가 성립한다.

**Independent Test**: 인증된 `GET /music/detail?id=10234` 요청으로 200과 MusicDetail 전체 필드·고정 좌표가 반환되는지, 주변곡 리더를 mock으로 두고 독립 검증한다.

**Acceptance Scenarios**:

1. **Given** 인증된 요청과 존재하는 곡 ID, **When** `id`로 조회하면, **Then** 200과 `success:true`, `data`에 MusicDetail 필드(id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location pc1~pc16, playCnt, youtubeCnt), `error:null`을 반환한다. (FR-001, FR-004)
2. **Given** 존재하는 곡, **When** 응답을 구성하면, **Then** `location`은 해당 곡의 baseline(`v2.1-pca16`) 좌표와 일치하고 진입 경로와 무관하게 동일하다. (FR-005)
3. **Given** 상세 대상 곡의 `youtubeUrl`이 null이고, **When** 조회하면, **Then** 링크 부재만으로 오류 처리하지 않고 200과 `youtubeUrl:null`을 유지한다. (FR-012)

---

### User Story 2 - 주변곡(Nearby) 목록 (Priority: P2)

사용자는 상세를 연 곡과 임베딩 공간에서 가까운 곡 10개를 거리와 함께 받아, 비슷한 곡으로 탐색을 이어갈 수 있다.

**Why this priority**: Nearby는 BE2 Discovery의 핵심 탐색 동선(Nearby → Journey)의 출발점이다. 상세(P1)와 한 응답으로 오지만, 주변곡이 비어도 상세는 성립하므로 P2로 분리해 독립 검증한다.

**Independent Test**: 주변곡 리더 mock이 11곡(자기 자신 포함)을 반환할 때, 응답 `neighbors`가 자기 자신을 제외한 10곡을 `distance` 오름차순으로 담는지 검증한다.

**Acceptance Scenarios**:

1. **Given** 존재하는 곡, **When** 상세를 조회하면, **Then** `data.neighbors`는 임베딩 공간 최근접 **10곡**을 담고, 각 항목은 MusicSummary 필드(id, title, artist, album, genres, youtubeUrl, location) + `distance`를 포함한다. (FR-006, FR-008)
2. **Given** 주변곡 후보에 상세 대상 곡 자신이 포함될 수 있고, **When** 목록을 구성하면, **Then** 자기 자신은 제외한다. (FR-006)
3. **Given** 주변곡 중 `youtubeUrl`이 null인 곡이 있고, **When** 목록을 반환하면, **Then** 재생 불가만으로 제외하지 않고 `youtubeUrl:null`로 포함한다. (FR-007)
4. **Given** 같은 곡·같은 baseline, **When** 조회를 반복하면, **Then** `neighbors`는 `distance` 오름차순, 동률 시 `id` 오름차순으로 매번 동일한 10곡·순서를 반환한다. (FR-009)
5. **Given** 전체 곡 수가 11곡 미만이라 최근접 후보가 10곡보다 적고, **When** 조회하면, **Then** 있는 만큼만 반환한다(오류 아님). (FR-006)

---

### User Story 3 - 없는 곡과 오류 구분 (Priority: P2)

호출자는 "존재하지 않는 곡"과 "요청 오류(검증·인증·내부 실패)"를 구분할 수 있다.

**Why this priority**: 404(없는 곡)와 400/401/500을 혼동하면 상세 진입 UX가 깨진다. 핵심 흐름은 아니라 P2.

**Acceptance Scenarios**:

1. **Given** 인증된 요청이지만 해당 `id`의 곡이 없고, **When** 조회하면, **Then** 404와 `MUSIC_NOT_FOUND`, 공통 실패 구조(`success:false`, `data:null`, `error:{code,message}`)를 반환한다. (FR-003, FR-011)
2. **Given** `id`가 누락/비정수/0 이하이고, **When** 조회하면, **Then** 400과 `INVALID_INPUT`을 반환한다. (FR-011)
3. **Given** 토큰이 없거나 위조·만료되었고, **When** 조회하면, **Then** 401을 반환한다. 세부 코드는 Core 인증(B-A) 확정 후. (FR-002, FR-011)
4. **Given** 조회 중 서버 내부 실패가 발생했고, **When** 응답하면, **Then** 500과 `INTERNAL_SERVER_ERROR`를 반환한다(부분·빈 상세로 응답하지 않음). (FR-011)

### Edge Cases

| 상황 | 동작 |
| --- | --- |
| `id` 누락/비정수/0 이하 | 400 `INVALID_INPUT` |
| 존재하지 않는 `id` | 404 `MUSIC_NOT_FOUND` |
| 상세 대상 곡 `youtubeUrl` null | 200 정상 (재생 불가 표시용, 오류 아님) |
| 주변곡 후보에 자기 자신 포함 | 자기 자신 제외 후 10곡 |
| 최근접 후보 < 10곡 | 있는 만큼만 반환 (오류 아님) |
| 주변곡 `distance` 동률 | `id` 오름차순 tie-break로 순서 안정 |
| 주변곡 전부 재생 불가 | 그대로 `youtubeUrl:null`로 포함 |
| 같은 곡 상세 반복 조회 | `playCnt`·`lastMusic` 불변 (순수 조회, 쓰기 0건) |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 — 상세 조회**: 시스템은 `GET /music/detail`에서 `id`로 해당 곡의 MusicDetail을 반환해야 한다(MUST). **근거**: [api-spec §3.2](../../docs/api-spec.md).
- **FR-002 — 인증**: `Authorization: Bearer {accessToken}` 인증을 요구해야 한다(MUST). **근거**: api-spec §0.1·§0.7·§3.2.
- **FR-003 — 없는 곡**: 존재하지 않는 `id`는 404 `MUSIC_NOT_FOUND`로 응답해야 한다(MUST). **근거**: api-spec §0.5·§3.2.
- **FR-004 — 상세 필드**: 응답은 MusicDetail 필드(id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location, playCnt, youtubeCnt)를 모두 포함해야 한다(MUST). 기존 타입·null 허용 범위를 임의로 좁히지 않는다. **근거**: api-spec §0.6·§3.2.
- **FR-005 — 고정 좌표**: 곡 좌표는 서빙 baseline `v2.1-pca16` 기준으로 진입 경로와 무관하게 동일해야 한다(MUST). 상세 조회가 좌표·모델을 변경해서는 안 된다(MUST NOT). **근거**: 헌법 V(좌표 안정성); 요구사항 §6.
- **FR-006 — 주변곡 선정**: `neighbors`는 임베딩 공간 최근접 **10곡**을 `distance` 오름차순으로 담아야 하며, 상세 대상 곡 자신은 제외해야 한다(MUST). 최근접 후보가 10곡보다 적으면 있는 만큼만 반환한다(MUST). **근거**: api-spec §3.2.
- **FR-007 — 주변곡 재생 불가 포함**: `youtubeUrl`이 null인 곡도 `neighbors`에서 제외하지 않고 `youtubeUrl:null`로 포함해야 한다(MUST). **근거**: api-spec §3.2; 요구사항 SONG-04.
- **FR-008 — 주변곡 필드**: `neighbors`의 각 항목은 MusicSummary 필드(id, title, artist, album, genres, youtubeUrl, location) + `distance`(float)를 포함해야 한다(MUST). **근거**: api-spec §0.6·§3.2.
- **FR-009 — 결정성/정렬**: `neighbors`는 `distance` 오름차순, 동률 시 `id` 오름차순으로 정렬해야 한다(MUST). 같은 곡·같은 baseline 재요청 시 동일한 10곡·순서를 반환해야 한다(MUST). **근거**: 2026-09-09 clarify; 헌법 V·VI.
- **FR-010 — 거리 척도**: 최근접 거리 척도는 서빙 baseline `v2.1-pca16`에 귀속되며(MUST), 서빙·요청 경로에서 모델을 재학습해서는 안 된다(MUST NOT). KNN 실행은 BE4 조회 port로 위임한다(헌법 X). 계산식은 BE4 확정(B-D). **근거**: 헌법 V·VII·X.
- **FR-011 — 오류 구조**: 검증 실패는 400 `INVALID_INPUT`, 없는 곡은 404 `MUSIC_NOT_FOUND`, 내부 실패는 500 `INTERNAL_SERVER_ERROR`, 인증 실패는 401(코드는 B-A 확정)로 응답하고, 실패 본문은 `success:false`, `data:null`, `error:{code,message}`(master `ErrorResponse`)를 제공해야 한다(MUST). **근거**: master `common.GlobalErrorCode`/`GlobalExceptionHandler`; api-spec §0.2·§0.4·§0.5. **[정정]**: `MUSIC_NOT_FOUND`는 master `GlobalErrorCode`에 미등록 → BE2 도메인 `MusicErrorCode`로 정의(정본 §0.5와 정합, 타 팀 블로커 아님).
- **FR-012 — 재생 불가 상세 곡**: 상세 대상 곡 자체의 `youtubeUrl`이 null이어도 200으로 정상 반환해야 한다(MUST). 재생 가능 여부는 클라이언트 표시용이다. **근거**: api-spec §0.6·§3.2.
- **FR-013 — 순수 조회(부수효과 없음)**: 상세 조회는 어떤 도메인 상태도 변경해서는 안 된다(MUST NOT). `playCnt` 증가·`user.lastMusic`/`lastActiveAt` 갱신 등 재생 기록은 별도 재생/기록 경로(BE3 Realtime 또는 Core) 책임이며, `/music/detail`은 좌표·모델뿐 아니라 어떤 저장소에도 쓰기를 하지 않는다. **근거**: 2026-09-09 clarify; 헌법 X(경계).

### Key Entities *(include if feature involves data)*

- **상세 요청**: `id`(1 이상 정수).
- **MusicDetail**: id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location(pc1~pc16), playCnt, youtubeCnt. 좌표는 baseline `v2.1-pca16` 고정.
- **주변곡(Neighbor)**: MusicSummary(id, title, artist, album, genres, youtubeUrl, location) + `distance`(float). distance는 baseline 거리 척도 기준.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: US1(상세 필드·좌표·재생불가 상세곡), US2(주변곡 10곡·자기제외·재생불가포함·결정성·부족 시 축소), US3(없는 곡·검증·인증·내부 실패) 시나리오를 모두 통과한다. 단 실좌표·KNN(B-D)·Core 인증(B-A) 확정 전에는 port mock 기준으로 검증한다.
- **SC-002**: 같은 좌표계 버전에서 동일 곡의 반환 PC1~PC16 차이는 0이며, 상세 조회에 의한 좌표·모델 변경은 0건이다. **근거**: FR-005; 헌법 V.
- **SC-003**: 같은 곡·같은 baseline에서 주변곡을 반복 조회하면 동일한 10곡과 동일한 순서(distance ASC, id ASC)를 반환한다. **근거**: FR-009.
- **SC-004**: 실패 요청(400/401/404/500)을 로그로 추적할 수 있으며, 로그·지표에 비밀정보·불필요한 개인정보 노출은 0건이다. **근거**: 헌법 VIII; 요구사항 §6.
- **SC-005**: 상세 조회 N회 반복 후 대상 곡 `playCnt`와 소유자 `lastMusic`/`lastActiveAt`의 변화는 0이다(순수 조회). **근거**: FR-013.

**plan 단계로 미루는 사항**:
- 곡 상세 저장소·스키마(Postgres vs Neo4j), 좌표·`playCnt`·`youtubeCnt` 컬럼, KNN 실행·인덱스(pgvector 미프로비저닝 여부 포함) — BE4 확인(B-D).
- `neighbors` 응답 표현(flat MusicSummary+distance vs 중첩)과 신규 응답 DTO 설계.
- 도메인 `MusicErrorCode`(404) 정의와 공통 핸들러(`GlobalExceptionHandler`) 연동(B-Common, BE1 합의).
- 테스트 인프라: master `@MapperScan`+`@WebMvcTest` 슬라이스 대응(002와 동일 과제).
- 응답 시간 예산 — §6 "유사곡 검색 1초"는 Nearby(주변곡) 응답에 해당하는지 plan에서 매핑.
- **관측 지표 (헌법 VIII)** — plan은 요청량·지연·오류율(404/500 비율 포함) 지표와 확인 방법을 명시해야 한다(MUST).
- **아키텍처 경계 (헌법 X)** — 상세·주변곡 규칙/응답 = BE2, 곡 조회·KNN 실행 = BE4. port 계약으로 분리.

## Assumptions

- **기준 인프라 = master 통합본**: backend/ 단일 Gradle 프로젝트, 공통 레이어 `common.ApiResponse/ErrorCode/GlobalErrorCode/CustomException/GlobalExceptionHandler`, MyBatis + Postgres(+Neo4j/Redis). 002-music-search와 동일 기준.
- 곡 상세·좌표·주변곡은 서빙 baseline(`v2.1-pca16`)에서 조회한다. 저장소·KNN 실행·인덱스는 BE4 확인(B-D 잔여).
- BE4 조회 인터페이스 경계를 존중한다(port 계약). 어댑터는 MyBatis 매퍼로 plan에서 설계.
- `MUSIC_NOT_FOUND`(404)는 BE2 도메인 `ErrorCode`로 정의 가능하므로 타 팀 블로커가 아니다. 인증(401, B-A)만 Core 도착 후 완결.
- neighbors 개수 10, 자기 자신 제외, 재생 불가 포함은 api-spec §3.2 확정 사항으로 채택한다. tie-break(id ASC)는 결정성 확보를 위한 잠정 결정으로 clarify에서 재확인한다.

## Dependencies / Blockers

| ID | 내용 | 상태 |
| --- | --- | --- |
| B-A | Core 인증·시큐리티 미구현. 401 코드 `GlobalErrorCode` 미등록 | 대기 (002와 공유) |
| B-D | BE4 곡 상세 저장소·좌표·KNN(neighbors) 실행·거리 계산식·인덱스 미확정 | 대기 |
| B-Common | 검증 예외→400, 도메인 404→`MUSIC_NOT_FOUND` 매핑을 공통 핸들러에 연동 (BE1 합의) | 진행 가능 (BE2 정의) |

**[정정 기록]**: api-spec 정본 §0.5는 `MUSIC_NOT_FOUND`(404)를 명시하나 master `GlobalErrorCode`에는 미등록. 002가 남긴 `VALIDATION_ERROR`/`INTERNAL_ERROR` 코드명 불일치와 함께 정본 §0.5 정합화 대상. 본 스펙은 BE2 도메인 에러로 `MUSIC_NOT_FOUND`를 정의해 정본과 맞춘다.
