# Contract: 음악 검색 (2026-09-09 master 기준)

## 외부 API (api-spec §3.1)

`GET /music/search` · 인증 필요. param: `query`(String, required), `page`(int, required, 0-based).

**성공 200** (`ApiResponse.success`):
```json
{ "success": true, "data": {
  "content": [ { "id": 10234, "title": "Love wins all", "artist": "IU", "album": "The Winning",
    "genres": ["K-Pop"], "youtubeUrl": "https://youtu.be/x",
    "location": { "pc1": -0.4213, "...": "...", "pc16": -0.123 } } ],
  "page": 0, "size": 10, "hasNext": true
}, "error": null }
```
- 결과 없음 → `content: []`, 200. youtubeUrl null 포함.
- 정렬은 관련성 순 (제목 완전일치 → 아티스트 완전일치 → 제목 앞일치 → 아티스트 앞일치 → 나머지 부분일치), 같은 순위 안에서는 id ASC (S15P21A405-234).
- `totalElements`·`totalPages` 는 없다 (S15P21A405-255). 세는 질의 하나가 응답의 ~7초였고 FE 가 쓰지 않는다. 다음 페이지 유무는 `hasNext`.

**실패** (`ApiResponse.fail`, `error:{code,message}`):
| 상황 | HTTP | code (master GlobalErrorCode) |
| --- | --- | --- |
| query 누락/공백, page 음수·비정수 | 400 | `INVALID_INPUT` |
| 토큰 없음/위조/만료 | 401 | B-A 대기 (코드 미정) |
| 내부 실패 | 500 | `INTERNAL_SERVER_ERROR` |

**[충돌]**: api-spec 정본 §0.5는 `VALIDATION_ERROR`/`INTERNAL_ERROR`. master 구현과 불일치 → 정본 갱신 대상(팀 확정).

## 내부 port (BE2 계약 / BE4 실행, 헌법 X)

```
interface MusicSearchReader {
    PageResult search(String query, int page, int size);  // substring(title|artist, ci), 관련성 순
    record PageResult(List<MusicSummary> content, boolean hasNext) {}
}
```
- 어댑터 = **MyBatis `MusicSearchMapper`** (B-D 후 구현). 시그니처는 BE4 합의 대상.

## 공통 레이어 (master, 재사용)

- `common.ApiResponse.success/fail`, `common.ErrorResponse`, `common.ErrorCode`(interface), `common.GlobalErrorCode`, `common.GlobalExceptionHandler`.
- **검증 예외→400 매핑은 공통 핸들러에 추가 필요**(R3, B-Common, BE1 합의).

## 인증 (B-A)
- Bearer subject 본인 식별(§0.7). Core 인증 미구현 → 401 코드 GlobalErrorCode에 추가 대기.
