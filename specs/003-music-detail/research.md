# Research: 노래 상세 조회 (Nearby 포함)

master 인프라(backend/, MyBatis, Postgres/Neo4j/Redis, 공통 레이어) 기준. 002-music-search 결정을 상속한다.

## R-Resp: neighbors flat 응답 표현

- **결정**: `MusicDetailResponse(@JsonUnwrapped MusicDetail detail, List<NeighborTrack> neighbors)`,
  `NeighborTrack(@JsonUnwrapped MusicSummary music, double distance)`.
- **근거**: api-spec §3.2는 상세 필드를 top-level에 flat으로, 각 neighbor도 MusicSummary 필드 + `distance`를 flat으로 둔다.
  Jackson `@JsonUnwrapped`로 기존 `MusicDetail`/`MusicSummary` record를 재사용하며 JSON을 평탄화 → 필드 중복 정의 없음(헌법: 재사용).
- **대안 기각**: 상세 필드를 복제한 새 flat record(중복), neighbors를 중첩(`{"detail":{...}}` → 계약 불일치).

## R-KNN: 최근접 계산 실행 위임

- **결정**: KNN(최근접 10곡, 자기 제외, distance ASC·id ASC, 재생불가 포함)은 **BE4 조회 port(`MusicDetailReader.findNeighbors`) 실행**. BE2는 개수(10)·정렬·제외 규칙을 **계약**으로 소유하고 응답을 조립한다.
- **근거**: 헌법 X(경계) — 거리·인덱스·검색 실행은 BE4. 거리 계산식(예: 16차원 L2)·인덱스(pgvector 미프로비저닝 여부)는 B-D 확정.
- **미해결(B-D)**: 실제 거리 척도 구현, KNN 쿼리(브루트포스 vs 인덱스), 인덱스 가용성.

## R-404: 도메인 에러 `MUSIC_NOT_FOUND`

- **결정**: `common.MusicErrorCode implements ErrorCode` enum에 `MUSIC_NOT_FOUND(HttpStatus.NOT_FOUND, "MUSIC_NOT_FOUND", "존재하지 않는 곡입니다.")` 정의. `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)`으로 던지고 master `GlobalExceptionHandler`가 `ErrorCode` 계약으로 처리.
- **근거**: 음악 도메인 에러는 BE2 소유. master `GlobalErrorCode`에 미등록(현재 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`만). 공통 `ErrorCode` 인터페이스가 이미 확장 지점을 제공하므로 **타 팀 블로커 아님**. 정본 §0.5 `MUSIC_NOT_FOUND`와 정합.
- **확인 필요(R-V)**: master `GlobalExceptionHandler`가 `CustomException`을 `ErrorCode`로 매핑하는지 구현 시 확인. 미비 시 BE1 합의 후 매핑 추가(B-Common).

## R-V: 검증 예외→400 매핑 (B-Common, 002와 공유)

- `@Min(1)` 위반(`ConstraintViolationException`)·타입 불일치가 400 `INVALID_INPUT`으로 매핑되는지 공통 핸들러에서 확인. 002가 남긴 동일 과제. 미비 시 BE1 소유로 매핑 추가.

## R-T: 테스트 인프라 (002와 공유)

- **결정**: `@WebMvcTest`는 master `@MapperScan`과 충돌 → **standalone MockMvc**(`MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(handler)`)로 컨트롤러 슬라이스 검증. 서비스는 mock reader로 유닛 검증.
- **근거**: 002-music-search 재베이스라인 결정 상속.

## R-Perf: 응답 예산

- §6 "유사곡 검색 응답 1초"를 Nearby(주변곡) 응답 예산 후보로 매핑(팀 확인). 상세 단일 조회는 표준 조회 예산. 백분위·부하 미정.
