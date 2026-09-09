# Research: 음악 검색 (2026-09-09 master 재베이스라인)

## R1. 검색 대상 저장소

- **Decision**: 텍스트 검색은 **Postgres + MyBatis**로 구현(어댑터=MyBatis 매퍼).
- **Rationale**: master에 postgres 드라이버·jdbc·mybatis-starter·datasource(application-db.yml) 통합됨. Neo4j는 Journey(그래프 경로)용으로 추정, 텍스트 검색엔 부적합. Redis는 캐시/실시간용.
- **Blocker (B-D)**: 곡 데이터가 실제로 Postgres에 있는지(Neo4j 가능성), `title/artist/youtubeCnt` 컬럼·`pc1~pc16` 저장 형태는 BE4 스키마 확정 후. 그전엔 매퍼 SQL 확정 불가.

## R2. 테스트 인프라 — @WebMvcTest vs master @MapperScan ⚠️

- **Problem**: `BackendApplication`에 `@MapperScan("...mapper")`. `@WebMvcTest` 슬라이스엔 SqlSessionFactory가 없어 매퍼 빈 생성 실패 → 컨텍스트 로드 실패(어제 이전 후 11개 테스트 red). master 자체 테스트는 `@WebMvcTest`를 안 씀(HelloControllerTests = 순수 유닛).
- **Decision**: 내 컨트롤러 테스트를 **standalone MockMvc**로 전환(`MockMvcBuilders.standaloneSetup(new MusicController(mockService)).setControllerAdvice(new GlobalExceptionHandler())`). Spring 컨텍스트 미로드 → @MapperScan 지뢰 회피, master 패턴과 정합.
- **Caveat**: standalone은 `@Validated` @RequestParam 검증(@NotBlank/@Min)을 기본 트리거 안 할 수 있음. 검증(E1/E2)이 standalone에서 안 걸리면 → 해당 검증은 유닛/명시 매핑으로 보완하고, **프로젝트 전역 @WebMvcTest 지원은 BE-infra 과제로 플래그**(아래).
- **Alternatives**: (a) 메인 `@MapperScan`을 별도 @Configuration으로 분리해 슬라이스에서 제외 → 근본 해결·전 팀 이득이나 **BE1/BE4 소유 파일, 합의 필요**(권고: 팀 이슈로 제기). (b) @WebMvcTest에 mock SqlSessionFactory 주입 → 해킹성, 기각.
- **권고**: 이 기능은 standalone MockMvc로 자립 검증, 동시에 (a)를 BE-infra 이슈로 올려 전역 @WebMvcTest 복구.

## R3. 검증 예외 → 400 매핑 ⚠️

- **Problem**: master `GlobalExceptionHandler`는 `CustomException`과 generic `Exception`만 처리. 검증 예외(HandlerMethodValidationException 등)가 generic으로 떨어져 **500 INTERNAL_SERVER_ERROR** 반환 → spec FR-008(검증→400 INVALID_INPUT) 위반.
- **Decision(권고)**: 공통 `GlobalExceptionHandler`에 검증 예외 핸들러 추가 → 400 `GlobalErrorCode.INVALID_INPUT`. 이는 전 엔드포인트가 겪는 갭이라 공통에서 고치는 게 근본(ponytail: 루트 원인·공유 함수).
- **경계(헌법 X)**: 해당 파일은 BE1 소유 → **BE1 합의 후 반영**(B-Common). 합의 전 임시로 music 스코프 @RestControllerAdvice를 둘 수 있으나 중복이라 비권장.

## R4. 에러코드·공통 응답

- **Decision**: master `common` 채택. `ApiResponse.success/fail`, `ErrorResponse(code,message)`, `GlobalErrorCode.INVALID_INPUT`(400)/`INTERNAL_SERVER_ERROR`(500).
- **[충돌]**: api-spec 정본 §0.5는 `VALIDATION_ERROR`/`INTERNAL_ERROR`. master와 코드명 불일치 → 정본 갱신 대상(스펙 FR-008에 기록). 어느 쪽이 옳은지 팀 확정, 임의 단정 안 함(헌법 IX).

## R5. substring 인덱스 (B-D 후)

- **Decision(조건부)**: Postgres면 `title`·`artist`에 `pg_trgm` GIN 인덱스로 `ILIKE %q%` 가속.
- **Rationale**: 양끝 wildcard는 B-tree 불가. substring 확정(전문검색 아님)이라 tsvector 미도입.
- **Blocker**: 실제 DB·스키마 B-D 확정 후 DDL/실행계획.

## R6. 성능 예산

- **Decision(제안)**: p95 < 300ms, 팀 확인. §6 "유사곡 1초"는 좌표 검색용이라 전용 안 함. B-D 후 벤치.

## 미해결
- **B-A**: Core 인증(401 코드·토큰 subject) 미구현.
- **B-D**: 검색 저장소·스키마·youtubeCnt·pg_trgm.
- **B-Common**: 공통 핸들러 검증→400 매핑(BE1 합의) + 전역 @WebMvcTest 지원(BE-infra).
