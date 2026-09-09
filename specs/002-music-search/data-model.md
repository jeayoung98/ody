# Data Model: 음악 검색 (2026-09-09 master 기준)

논리 모델. 물리 스키마·컬럼은 B-D(BE4) 확정 후.

## 검색 요청

| 필드 | 타입 | 제약 |
| --- | --- | --- |
| query | String | required, 공백만/빈값 거절(@NotBlank), 앞뒤 trim |
| page | int | required, 0-based, @Min(0) |
| size | int | 서버 고정 10 (요청 파라미터 아님) |

## MusicSummary (검색 결과 항목, §0.6)

| 필드 | 타입 | 비고 |
| --- | --- | --- |
| id | Long | 곡 ID |
| title / artist | String | 매칭 대상 |
| album | String \| null | |
| genres | List<String> \| null | 다형 표현은 B-Field |
| youtubeUrl | String \| null | null이면 재생 불가, 제외 안 함 |
| location | Location(pc1~pc16 float) | baseline v2.1-pca16 고정 |

`music/dto/Location.java`, `MusicSummary.java`, `PageResponse.java` — 이미 backend/src로 이전됨.

## PageResponse<T> (§0.3)

content, page, size(=10), totalElements, totalPages, hasNext.

## 공통 응답/에러 (master 실물)

- 성공: `ApiResponse.success(data)` → `{success:true, data, error:null}`.
- 실패: `ApiResponse.fail(errorCode)` → `{success:false, data:null, error:{code,message}}` (`ErrorResponse`).
- 에러코드: `GlobalErrorCode` — `INVALID_INPUT`(400), `INTERNAL_SERVER_ERROR`(500). 401은 B-A 후 추가.
- `ErrorCode`는 인터페이스 → 필요 시 도메인 enum이 구현(현재 검색은 GlobalErrorCode로 충분).

## MyBatis 매핑 (어댑터, B-D 후)

- 매퍼 `MusicSearchMapper` (port `MusicSearchReader` 어댑터). `@MapperScan` 범위에 포함되게 배치.
- 쿼리: `WHERE title ILIKE #{q} OR artist ILIKE #{q}` (q = `%query%`), `ORDER BY youtube_cnt DESC, id ASC`, `LIMIT 10 OFFSET #{page}*10`, 별도 count.
- 컬럼명·pc 저장 형태·youtube_cnt는 BE4 스키마 확정 후 매핑.

## 데이터 계보 (B-D)
- youtube_cnt 출처·갱신, pc1~pc16 baseline 버전, 곡 ID 매핑 — BE4 스키마 확정 시 기록.
