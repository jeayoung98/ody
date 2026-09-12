# Feature Specification: 음악 검색

**Feature Branch**: `002-music-search`

**Created**: 2026-09-08

**Status**: Draft — 2026-09-09 master 인프라 기준 재베이스라인 (에러코드·공통레이어 정정)

**Input**: 인증된 사용자가 검색어로 곡을 찾는다. 곡명·아티스트명으로 매칭하여 페이지네이션된 곡 목록(MusicSummary)을 반환한다. `GET /music/search` (요구사항 SEARCH-01). 공통 응답·에러 계약은 **master에 통합된 실제 공통 레이어**(backend `common.ApiResponse`/`GlobalErrorCode` 등)를 기준으로 한다.

## Clarifications

### Session 2026-09-08

- Q: query 매칭 규칙을 어떻게 정할까? (곡명·아티스트명 대상) → A: 부분일치(substring), 대소문자 무시. 곡명 또는 아티스트명에 query가 포함되면 매칭.
- Q: 검색 결과 정렬 순서를 무엇으로 할까? → A: youtubeCnt(유튜브 조회수) 내림차순, 동률 시 id 오름차순 tie-break.

### Session 2026-09-09 (master 인프라 재베이스라인)

- 결정: 어제 스펙은 우리가 정한 가정(api-spec 정본 §0.5 에러코드, 깨끗한 공통 레이어) 위에 작성됐다. master에 실제 인프라가 통합되어(backend/ 프로젝트, MyBatis, Postgres/Neo4j/Redis, BE1 공통 레이어) **master 기준으로 정정**한다.
- 에러코드: master `GlobalErrorCode` 실제 값을 채택 — 검증 실패 `INVALID_INPUT`(400), 내부 실패 `INTERNAL_SERVER_ERROR`(500). api-spec 정본 §0.5의 `VALIDATION_ERROR`/`INTERNAL_ERROR`와 불일치 → 정본 문서 갱신 대상으로 [충돌]에 기록(어느 쪽이 옳은지는 팀 확정).
- 공통 응답: `ApiResponse.success/fail`, `ErrorResponse(code,message)`, `ErrorCode`(인터페이스)+`GlobalErrorCode`(enum), `CustomException`.
- 인증(401): master에 Core 인증·시큐리티 미구현, 401 코드도 `GlobalErrorCode`에 없음 → **B-A 여전히 블로커**, 코드값은 Core 확정 대기.
- 데이터 접근: MyBatis(+Postgres). 검색 대상 저장소(Postgres vs Neo4j)·`youtubeCnt` 컬럼·pg_trgm는 plan/BE4 확인(B-D 잔여).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 검색어로 곡 찾기 (Priority: P1)

사용자가 검색창에 곡명이나 아티스트명을 입력하면, 매칭되는 곡 목록을 페이지 단위로 받아 지도에서 해당 곡으로 이동할 수 있다.

**Why this priority**: 지도 탐색과 별개로 사용자가 아는 곡을 바로 찾는 유일한 진입점. 이 스토리 하나만으로 검색 기능의 가치가 성립한다.

**Independent Test**: 인증된 `GET /music/search?query=IU&page=0` 요청으로 곡 목록·페이지 정보·곡 정보와 고정 좌표가 반환되는지 독립 검증한다.

**Acceptance Scenarios**:

1. **Given** 인증된 요청과 매칭 곡이 있고, **When** `query`와 `page`로 검색하면, **Then** 200과 `success:true`, `data.content`(MusicSummary 배열), 페이지 정보(page/size/totalElements/totalPages/hasNext), `error:null`을 반환한다. (FR-001, FR-004)
2. **Given** 매칭 곡이 있고, **When** 응답을 구성하면, **Then** 각 항목은 MusicSummary 필드(id, title, artist, album, genres, youtubeUrl, location pc1~pc16)를 포함하고 `location`은 해당 곡의 baseline 좌표와 일치한다. (FR-005, FR-006)
3. **Given** 매칭 곡 중 `youtubeUrl`이 null인 곡이 있고, **When** 목록을 반환하면, **Then** 링크 부재만으로 제거하지 않고 `youtubeUrl:null`을 유지한다. (FR-007)
4. **Given** 매칭 곡이 페이지 크기보다 많고, **When** `page`를 지정하면, **Then** 서버 고정 크기(10) 단위로 해당 페이지를 반환하고 `hasNext`로 다음 페이지 존재를 알린다. (FR-004)

### User Story 2 - 결과 없음을 실패와 구분 (Priority: P2)

호출자는 "매칭 곡 없음"과 "요청 오류(검증·인증·내부 실패)"를 구분할 수 있다.

**Why this priority**: 빈 결과를 오류로, 오류를 빈 결과로 오인하면 UX가 깨진다. 핵심 흐름은 아니라 P2.

**Acceptance Scenarios**:

1. **Given** 인증된 요청이지만 매칭 곡이 없고, **When** 검색하면, **Then** 200과 빈 `content` 배열을 반환한다(오류 아님). (FR-002)
2. **Given** `query`가 누락/공백이거나 `page`가 음수·비정수고, **When** 검색하면, **Then** 400과 `INVALID_INPUT`, 공통 실패 구조를 반환한다. (FR-008)
3. **Given** 토큰이 없거나 위조·만료되었고, **When** 검색하면, **Then** 401을 반환한다. 세부 코드는 Core 인증(B-A) 확정 후(master `GlobalErrorCode`에 401 코드 미등록). (FR-003, FR-008)
4. **Given** 검색 중 서버 내부 실패가 발생했고, **When** 응답하면, **Then** 500과 `INTERNAL_SERVER_ERROR`, 공통 실패 구조를 반환한다(성공 목록으로 응답하지 않음). (FR-008)

### Edge Cases

| 상황 | 동작 |
| --- | --- |
| `query` 공백/빈 문자열 | 400 `INVALID_INPUT` (required, 공백만인 값 불허) |
| `page` 음수/비정수 | 400 `INVALID_INPUT` (타입·범위 위반) |
| `page`가 총 페이지 수 초과 | 빈 `content` + 200 (오류 아님) |
| 정렬 동률 (youtubeCnt 같음) | id 오름차순 tie-break로 페이지 간 순서 안정 |
| 곡명·아티스트명 동시 매칭 | 한 번만 결과에 포함(곡 단위 중복 없음) |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 — 검색 조회**: 시스템은 `GET /music/search`에서 `query`와 `page`로 매칭되는 곡 목록을 반환해야 한다(MUST). **근거**: [api-spec §3.1](../../docs/api-spec.md); 요구사항 SEARCH-01.
- **FR-002 — 빈 결과**: 매칭 곡이 없으면 빈 `content` + 200으로 반환해야 하며, 오류로 처리해서는 안 된다(MUST). **근거**: api-spec §3.1.
- **FR-003 — 인증**: `Authorization: Bearer {accessToken}` 인증을 요구해야 한다(MUST). **근거**: api-spec §0.1·§0.7·§3.1.
- **FR-004 — 페이지네이션**: 응답은 `content`와 페이지 정보(page, size, totalElements, totalPages, hasNext)를 포함해야 하며, 페이지 크기는 서버에서 10으로 고정한다(MUST). 클라이언트는 `size`를 하드코딩하지 않는다. api-spec 예시의 `size:20`은 본문 "10 고정"과의 알려진 불일치(헌법 충돌표 기록)로, 본문 기준 10을 채택한다. **근거**: api-spec §0.3; 헌법 "발견된 충돌·불일치" 페이지 크기 항목.
- **FR-005 — 곡 정보**: 각 항목은 MusicSummary 필드(id, title, artist, album, genres, youtubeUrl, location)를 유지해야 한다(MUST). 기존 타입·null 허용 범위를 임의로 좁히지 않는다. **근거**: api-spec §0.6.
- **FR-006 — 고정 좌표**: 곡 좌표는 서빙 baseline `v2.1-pca16` 기준으로 진입 경로와 무관하게 동일해야 한다(MUST). 검색이 좌표·모델을 변경해서는 안 된다(MUST NOT). **근거**: 요구사항 §6 데이터-일관성.
- **FR-007 — 재생 불가 곡 표시**: `youtubeUrl`이 null인 곡도 결과에서 제외하지 않고 `youtubeUrl:null`을 유지해야 한다(MUST). **근거**: 요구사항 SONG-04; api-spec §0.6.
- **FR-008 — 오류 구조**: 검증 실패는 400 `INVALID_INPUT`, 내부 실패는 500 `INTERNAL_SERVER_ERROR`(master `GlobalErrorCode` 기준), 인증 실패는 401(코드는 B-A 확정)로 응답하고, 실패 본문은 `success:false`, `data:null`, `error:{code,message}`(master `ErrorResponse`)를 제공해야 한다(MUST). **근거**: master `common.GlobalErrorCode`/`GlobalExceptionHandler`; api-spec §0.2·§0.4. **[충돌]**: api-spec 정본 §0.5는 `VALIDATION_ERROR`/`INTERNAL_ERROR`를 명시 — master 구현과 코드명 불일치. 본 스펙은 master 기준을 채택하고 정본 §0.5 갱신을 충돌 항목으로 남긴다.
- **FR-009 — 매칭 규칙**: 시스템은 `query`가 곡명 **또는** 아티스트명에 부분일치(substring)로 포함되는 곡을 매칭해야 한다(MUST). 대소문자를 구분하지 않는다(MUST). 앞뒤 공백은 무시하고, 공백만이거나 빈 `query`는 400 `INVALID_INPUT`으로 거절한다(MUST). 곡명·아티스트명 양쪽에 매칭되어도 곡은 결과에 한 번만 포함한다(MUST). **근거**: 2026-09-08 clarify; api-spec §2.7 사용자검색 부분일치 선례.
- **FR-010 — 정렬 순서**: 검색 결과는 **관련성 순**으로 정렬해야 한다(MUST). 순위는 ① 제목 완전일치 ② 아티스트 완전일치 ③ 제목 앞일치 ④ 아티스트 앞일치 ⑤ 나머지 부분일치 (완전일치가 필드 구분보다 앞서다 — 정확도가 더 강한 신호다) 이고, 같은 순위 안에서는 `id` 오름차순으로 tie-break 한다. 대소문자는 구분하지 않는다. 이 정렬은 페이지 간 순서 안정성을 보장한다.
  **근거**: 2026-09-12 변경(S15P21A405-234). 직전 규칙은 `youtubeCnt` 내림차순이었으나(2026-09-08 clarify) 그 값이 662만 행 전부 0 이라 사실상 `id` 단독 정렬이었고 사용자에겐 무작위로 보였다. 또 그 정렬이 조기 종료를 막아 검색 응답 26초의 직접 원인이었다(운영 DB 실측).
  **구현 제약**: 점수를 매겨 정렬하면(ORDER BY CASE) 일치 전체를 읽어야 해 26초로 되돌아간다. 단계별 조회(각 단계 `ORDER BY id LIMIT`)로 구현한다.

### Key Entities *(include if feature involves data)*

- **검색 요청**: `query`(문자열), `page`(0-based 정수).
- **검색 결과 항목(MusicSummary)**: id, title, artist, album, genres, youtubeUrl, location(pc1~pc16). 좌표는 baseline `v2.1-pca16` 고정.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A1~A4(성공·필드·좌표·페이지네이션)와 US2의 빈 결과·검증·인증·내부 실패 시나리오를 모두 통과한다. 단 A2(좌표 baseline 일치)·A4(실제 다중 페이지)·인증(E4)은 실데이터(B-D)·Core 인증(B-A) 확정 후 완전 충족되며, 그 전에는 port mock 기준으로 검증한다.
- **SC-002**: 같은 좌표계 버전에서 동일 곡의 반환 PC1~PC16 차이는 0이며, 검색에 의한 좌표·모델 변경은 0건이다. **근거**: FR-006; 요구사항 §6.
- **SC-003**: 실패 요청을 로그로 추적할 수 있으며, 로그·지표에 비밀정보·불필요한 개인정보 노출은 0건이다. **근거**: 요구사항 §6 로깅.

- **SC-004**: query가 곡명·아티스트명에 부분일치(대소문자 무시)하는 곡을 빠짐없이 찾고, 결과는 관련성 순(제목 완전→아티스트 완전→제목 앞→아티스트 앞→나머지)·동순위 id 오름차순으로 정렬되어 같은 query·page 재요청 시 동일 순서를 반환한다. **근거**: FR-009·FR-010.

**plan 단계로 미루는 사항**:
- 검색 대상 저장소 확정(Postgres vs Neo4j) 및 `youtubeCnt`·`title`·`artist` 스키마 — BE4 확인.
- MyBatis 매퍼 기반 substring 매칭·정렬·페이징 구현과 인덱스 전략(Postgres면 pg_trgm).
- 테스트 인프라: master `@MapperScan`+`@WebMvcTest` 충돌 대응(슬라이스 방식 결정).
- 응답 시간 예산 — §6 "유사곡 검색 1초"는 좌표 검색 대상이라 전용 안 함.
- **관측 지표 (헌법 VIII)** — plan은 요청량·지연·오류율 지표와 확인 방법을 명시해야 한다(MUST).
- **아키텍처 경계 (헌법 X)** — 텍스트 검색이 BE2 API·규칙 / BE4 인덱스·실행. port 계약으로 분리.

## Assumptions

- **기준 인프라 = master 통합본**: backend/ 단일 Gradle 프로젝트, 공통 레이어 `common.ApiResponse/ErrorCode/GlobalErrorCode/CustomException/GlobalExceptionHandler`, MyBatis + Postgres(+Neo4j/Redis). 어제의 임시 공통(`common.response`/`common.exception`)·가정은 폐기.
- 공통 응답·에러 계약은 master 실물을 기준으로 하되, api-spec 정본 §0.5와의 에러코드 불일치는 정본 갱신 대상으로 남긴다(FR-008 [충돌]).
- 곡 데이터·좌표는 서빙 baseline(`v2.1-pca16`)에서 조회한다. 검색 대상 저장소(Postgres/Neo4j)·`youtubeCnt` 컬럼·인덱스는 BE4 확인(B-D 잔여).
- BE4 검색 인터페이스 경계를 존중한다(port 계약). 어댑터는 MyBatis 매퍼로 plan에서 설계.
- 인증(B-A)은 Core 미구현이라 검증(E4)·401 코드는 Core 도착 후.
