# Research: 음악·아티스트 조건 검색

**Date**: 2026-09-17. 저장소 코드 조사 결과이며 운영 DB 실측 결과가 아니다.

## R1. 검색 경로

- Decision: 기존 findPage를 유지하고 findFilteredPage 하나 추가.
- Rationale: MusicSearchMapper.xml에 이미 통합 검색의 4단계 관련성·2초 timeout·videoId 제외가 구현되어 있다. 기존 SQL을 일반화할 이유가 없다.
- Alternatives: 모든 모드를 OR/CASE 한 쿼리로 통합하면 기존 실행계획도 바뀐다. 검색 결과 사후 필터링은 페이지 밖 정답을 누락한다.

## R2. 조건 전달

- Decision: query/music/artist를 가진 불변 record 하나에서 trim·허용 조합 검증. SQL lowercase와 LIKE escape는 기존 adapter 책임.
- Rationale: controller→service→reader에서 세 문자열의 의미와 검증을 중복하지 않는다.
- Alternatives: 모드 enum·전략 객체·별도 서비스는 불필요. API에 mode를 추가하면 조건과 중복 상태가 생긴다.

## R3. 테이블과 인덱스

- Decision: music.title/artist와 기존 함수 인덱스 재사용. 초기 DDL 없음.
- Rationale: 명세는 아티스트 ID·별칭·후보 목록을 요구하지 않는다. XML에 lower(title) text_pattern_ops와 coalesce(lower(artist), '') text_pattern_ops 정의가 기록되어 있다.
- Alternatives: artist 테이블 정규화, pg_trgm, 캐시, 복합 인덱스 선도입은 현재 요구에 불필요.
- Evidence limit: 실제 배포 DB의 인덱스 상태는 미확인. 인덱스가 있어도 두 조건의 선택도·정렬·OFFSET에 따라 느려질 수 있다. WHERE 표현식의 구조를 기존 인덱스와 맞추고 plan을 확인한다. 공백까지 글자 단위로 같아야 하는 것은 아니다.

## R4. 성능 보호

- Decision: 단계별 ID LIMIT, size+1, 장르 일괄 조회, timeout=2와 prepareThreshold=0 유지.
- Rationale: 기존 adapter, mapper 및 application-db.yml에 이미 적용된 보호 장치다.
- Alternatives: COUNT, 전체 후보 점수 정렬, generic plan 설정 변경은 제외.
- Verification: quickstart의 같은 데이터·부하 전후 비교로 판정한다. EXPLAIN 추정만으로 300ms 달성을 주장하지 않는다.

## R5. UI의 중간 상태

- Decision: 음악 칩만 있고 아티스트 입력이 없으면 요청하지 않고 입력 안내. 아티스트 칩만 있으면 아티스트 검색 실행.
- Rationale: 세 경로만 필요하므로 음악 단독 API를 추가하지 않는다. 두 번째 조건을 입력하기 전 통합 결과를 필터 결과처럼 보여주지 않는다.
- Clarification of handoff: 칩 제거 시 남은 입력만 통합 검색으로 사용한다. 남은 입력이 없으면 빈 검색 상태다. 이전 전달 문서의 Radiohead 복원 예시는 이 규칙과 충돌하여 정정한다.

## R6. 기존 테스트와 인증

- Decision: 현재 @WebMvcTest/Mockito 기반 검색 테스트를 확장한다. 과거 standalone MockMvc·스키마 미확정 설명은 폐기한다.
- Rationale: MusicSearchControllerTests는 이미 슬라이스 테스트다. SQL의 실제 정렬/누락은 mock으로 증명되지 않으므로 전용 PostgreSQL 검증도 필요하다.
- Limitation: SecurityConfig가 임시 permitAll 상태이고 기존 슬라이스는 필터를 끈다. 401은 Core 정책 복구 후 실환경에서 검증한다. 이 계획은 공통 보안 변경을 포함하지 않는다.

## R7. FE 계약

- Decision: query 단독 또는 artist(+music), page 필수. 같은 endpoint와 PageResponse 유지.
- Rationale: 현재 BE는 query/page이며 로컬 FE는 q/배열 목 API다. 현재 체크아웃의 FE에 한정된 관찰이고 배포 FE 상태를 단정하지 않는다.
- Alternatives: q 별칭 지원이나 새 endpoint 추가 대신 FE의 직렬화 함수를 계약에 맞춘다.
