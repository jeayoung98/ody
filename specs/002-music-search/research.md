# Research: 음악 검색

Phase 0. spec/헌법이 남긴 결정 가능한 항목을 해소하고, 진짜 막힌 것만 보류로 넘긴다.

## R1. 아키텍처 경계 — 텍스트 검색은 BE2인가 BE4인가 (헌법 X)

- **Decision**: BE2가 API·입력검증·응답조립과 매칭/정렬 **계약**을 소유. 실제 인덱스·쿼리 **실행**은
  BE4 조회 port(`MusicSearchReader`) 뒤로 분리.
- **Rationale**: 헌법 "BE4=검색 엔진·인덱스·평가, BE2=검색 호출·API·업무 규칙". 001이 이미
  `MajorTrackReader`로 같은 분리를 확립 → 새 경계 발명 아님(헌법 X: 임의 경계 금지). substring/정렬은
  업무 규칙이라 port **계약**에 명시하고, 인덱스 선택은 BE4 실행 재량.
- **Alternatives**: BE2가 직접 DB 쿼리 → BE4 인덱스·거리 책임과 충돌, 경계 위반. 기각.

## R2. 관측 지표 (헌법 VIII)

- **Decision**: 기존 actuator + micrometer-prometheus의 `http.server.requests` 재사용 →
  엔드포인트별 요청량·지연(백분위)·오류율 무료 수집. 실패 시 구조화 로그(코드·상태),
  `query` 원문은 로그에 truncate/해시(PII·검색어 과다 노출 방지).
- **Rationale**: build.gradle에 이미 있음 → 신규 의존성 0(YAGNI). 헌법 VIII "지표·확인 방법 명시" 충족.
- **Alternatives**: 커스텀 메트릭 카운터 → 초기엔 불필요. 필요 시 추가.

## R3. substring 매칭 인덱스 전략 (B-D 의존)

- **Decision(조건부)**: 저장소가 Postgres면 title·artist에 `pg_trgm` GIN 인덱스로 `ILIKE %q%` 가속.
- **Rationale**: 양끝 wildcard substring은 B-tree 불가. clarify에서 전문검색이 아닌 substring으로
  확정 → tsvector 도입 안 함. team memory상 서빙 baseline이 pgvector(Postgres) → pg_trgm 자연스러움.
- **Alternatives**: tsvector 전문검색(clarify와 불일치, 기각), 애플리케이션 필터(662만 곡 JVM 적재 불가, 기각).
- **Blocker**: build.gradle에 DB 드라이버 없음, 실제 스키마·컬럼(youtubeCnt) 미확인 → BE4(B-D) 확정 후 DDL.

## R4. 성능 예산

- **Decision(제안)**: p95 < 300ms 목표로 제안, 팀 확인 대상.
- **Rationale**: 인덱스된 substring+정렬+limit 10은 통상 수십 ms. 요구사항 §6 "유사곡 검색 1초"는
  좌표 기반 검색 대상이므로 텍스트 검색에 전용하지 않음(헌법 IX 추정 금지).
- **Blocker**: 실제 데이터 분포·트래픽 미검증 → B-D 후 벤치마크로 확정.

## R5. 페이지네이션 방식

- **Decision**: offset/limit(page*10, 10) 유지.
- **Rationale**: 검색 UX상 깊은 페이지 희소 → offset 깊이 비용 실질 무해(YAGNI). 정렬이 youtubeCnt DESC·id ASC로
  안정적이라 페이지 경계 중복/누락 없음.
- **Alternatives**: keyset 페이징 → 깊은 페이지·무한스크롤 필요 시 도입. 현재 불필요.

## 미해결 (보류)

- **B-A**: Core 인증 미구현. `INVALID_TOKEN`/`TOKEN_EXPIRED` ErrorCode 미등록, 토큰 subject 추출 경로 없음.
- **B-D**: BE4 검색 인터페이스·저장소·스키마·곡 데이터·youtubeCnt 컬럼·pg_trgm 가용성 미제공.
- **B-Field**: genres 다형(list/string/null) 실제 계약 표현(§0.6 미명시분).
