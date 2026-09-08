# Contract: 음악 검색

## 외부 API (확정, api-spec §3.1)

`GET /music/search` · 인증 필요.

| param | 타입 | 필수 | 비고 |
| --- | --- | --- | --- |
| query | String | O | 곡명·아티스트명 substring(대소문자 무시). 공백만/빈값 → VALIDATION_ERROR |
| page | int | O | 0-based |

**성공 200:**
```json
{ "success": true, "data": {
  "content": [ {
    "id": 10234, "title": "Love wins all", "artist": "IU", "album": "The Winning",
    "genres": ["K-Pop"], "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
    "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 }
  } ],
  "page": 0, "size": 10, "totalElements": 137, "totalPages": 14, "hasNext": true
}, "error": null }
```
- 결과 없음 → `content: []`, 200. youtubeUrl null 곡 포함. 정렬: youtubeCnt DESC, id ASC.

**실패:**
| 상황 | HTTP | code |
| --- | --- | --- |
| query 누락/공백, page 음수·비정수 | 400 | VALIDATION_ERROR |
| 토큰 없음/위조/무효 | 401 | INVALID_TOKEN |
| 토큰 만료 | 401 | TOKEN_EXPIRED |
| 내부 실패 | 500 | INTERNAL_ERROR |

본문은 공통 실패 구조 `{ success:false, data:null, error:{code,message} }`.

## 내부 port (BE4 합의 대상, 헌법 X)

```
interface MusicSearchReader {
    // substring(title|artist, 대소문자 무시) 매칭 → youtubeCnt DESC, id ASC → offset page*size, limit size
    PageResult search(String query, int page, int size);
}
// PageResult: List<MusicSummary> content + long totalElements
```

- BE2는 이 계약(매칭·정렬 의미)을 소유. BE4는 인덱스(pg_trgm 등)·쿼리 실행을 구현.
- **미합의**: 실제 시그니처·예외 변환·PageResult 형태는 BE4와 확정(B-D). 위는 제안.

## 인증 계약 (B-A)

- Bearer 토큰 subject에서 본인 식별(§0.7). 현재 Core 인증 미구현 → 통합 시 401 코드 2종 ErrorCode 추가.
