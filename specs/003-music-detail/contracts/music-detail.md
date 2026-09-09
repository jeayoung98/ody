# Contract: 노래 상세 조회 (Nearby 포함) — master 기준

## 외부 API (api-spec §3.2)

`GET /music/detail` · 인증 필요. param: `id`(int, required, ≥1).

**성공 200** (`ApiResponse.success`):
```json
{ "success": true, "data": {
  "id": 10234, "mbid": "b1a9c0e9-...", "title": "Love wins all", "artist": "IU",
  "bpm": 128.4, "duration": 275, "album": "The Winning", "genres": ["K-Pop"],
  "youtubeUrl": "https://youtu.be/x",
  "location": { "pc1": -0.4213, "...": "...", "pc16": -0.123 },
  "playCnt": 1428, "youtubeCnt": 3,
  "neighbors": [ {
    "id": 10877, "title": "Through the Night", "artist": "IU", "album": "Palette",
    "genres": ["K-Pop"], "youtubeUrl": "https://youtu.be/y",
    "location": { "pc1": -0.3980, "...": "...", "pc16": -0.098 }, "distance": 0.0412
  } ]
}, "error": null }
```
- `neighbors`: 임베딩 공간 최근접 **10곡**, `distance` 오름차순(동률 id 오름차순), **자기 자신 제외**, 재생불가(`youtubeUrl:null`) 포함. 후보 < 10이면 있는 만큼.
- 상세 대상 곡 `youtubeUrl:null`이어도 200. 거리 척도 = baseline `v2.1-pca16`.

**실패** (`ApiResponse.fail`, `error:{code,message}`):
| 상황 | HTTP | code |
| --- | --- | --- |
| `id` 누락/비정수/≤0 | 400 | `INVALID_INPUT` (master GlobalErrorCode) |
| 토큰 없음/위조/만료 | 401 | B-A 대기 (코드 미정) |
| 존재하지 않는 곡 | 404 | `MUSIC_NOT_FOUND` (신규 `MusicErrorCode`, 정본 §0.5) |
| 내부 실패 | 500 | `INTERNAL_SERVER_ERROR` (master GlobalErrorCode) |

## 내부 port (BE2 계약 / BE4 실행, 헌법 X)

```
interface MusicDetailReader {
    Optional<MusicDetail> findDetail(long id);
    List<NeighborTrack> findNeighbors(long id, int k);  // 자기 제외, distance ASC, id ASC, 재생불가 포함
}
record NeighborTrack(@JsonUnwrapped MusicSummary music, double distance) {}
```
- 어댑터 = **MyBatis `MusicDetailMapper`**(B-D 후 구현). 거리 계산식·KNN 실행·인덱스는 BE4 확정.

## 공통 레이어 (master, 재사용)

- `common.ApiResponse.success/fail`, `common.ErrorResponse`, `common.ErrorCode`(interface), `common.GlobalErrorCode`, `common.GlobalExceptionHandler`.
- 신규 도메인 에러: `common.MusicErrorCode implements ErrorCode` → `MUSIC_NOT_FOUND(404)`. `CustomException`으로 던지고 공통 핸들러가 처리.
- 검증 예외→400 매핑은 공통 핸들러 확인/보강(B-Common, BE1 합의, 002와 공유).

## 인증 (B-A)
- Bearer subject 본인 식별(§0.7). Core 인증 미구현 → 401 코드 GlobalErrorCode에 추가 대기.
