# Data Model: 음악 검색

논리 모델만 정의. 물리 스키마·DDL은 B-D(BE4 저장소) 확정 후.

## 검색 요청

| 필드 | 타입 | 제약 |
| --- | --- | --- |
| query | String | required, 공백만/빈값 거절(@NotBlank), 앞뒤 공백 trim |
| page | int | required, 0-based, @Min(0) |
| size | int | 서버 고정 10 (요청 파라미터 아님) |

## MusicSummary (검색 결과 항목, §0.6)

| 필드 | 타입 | 비고 |
| --- | --- | --- |
| id | Long(int) | 곡 ID |
| title | String | |
| artist | String | |
| album | String \| null | |
| genres | list \| string \| null | 다형 표현은 B-Field에서 확정 |
| youtubeUrl | String \| null | null이면 재생 불가, 결과에서 제외 안 함(FR-007) |
| location | Location(pc1~pc16, 각 float) | baseline v2.1-pca16 고정값 |

기존 `music/dto/Location.java` 재사용. `MusicSummary.java`는 신규(현재 MusicDetail만 존재).
MusicDetail = MusicSummary + mbid·bpm·duration·playCnt·youtubeCnt (검색은 Summary만 반환).

## PageResponse<T> (목록 래퍼, §0.3)

| 필드 | 타입 | 비고 |
| --- | --- | --- |
| content | List<T> | 결과 없으면 빈 배열 |
| page | int | 요청 page |
| size | int | 10(참고값) |
| totalElements | long | 총 매칭 수 |
| totalPages | int | |
| hasNext | boolean | |

user/search·playlist 등 다른 목록 API와 공유 가능한 공통 래퍼.

## 정렬·매칭 규칙 (port 계약)

- 매칭: `title ILIKE %query% OR artist ILIKE %query%` (대소문자 무시, substring).
- 정렬: youtubeCnt DESC, 동률 id ASC.
- 곡 단위 유일(title·artist 동시 매칭 시 1회).

## 데이터 계보 (B-D 확인 대상)

- youtubeCnt 컬럼 출처·갱신 계보, location pc1~pc16 baseline 버전 식별, 곡 ID 매핑 — BE4 스키마 확정 시 기록.
