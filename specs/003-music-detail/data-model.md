# Data Model: 노래 상세 조회 (Nearby 포함)

## 요청

| 필드 | 타입 | 제약 |
| --- | --- | --- |
| `id` | long | required, ≥ 1 (`@Min(1)`) |

## 응답 DTO

### MusicDetailResponse (신규)

```
record MusicDetailResponse(
    @JsonUnwrapped MusicDetail detail,   // 상세 필드 flat 전개 (정본 §3.2 top-level)
    List<NeighborTrack> neighbors) {}
```

### NeighborTrack (신규)

```
record NeighborTrack(
    @JsonUnwrapped MusicSummary music,   // id,title,artist,album,genres,youtubeUrl,location
    double distance) {}                  // baseline 거리 척도
```

### MusicDetail (기존, 재사용 — 정본 §0.6)

`id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location(pc1~pc16), playCnt, youtubeCnt`

### MusicSummary (기존, 재사용 — 정본 §0.6)

`id, title, artist, album, genres, youtubeUrl, location(pc1~pc16)`

## Port (BE2 계약 / BE4 실행)

```
interface MusicDetailReader {
    Optional<MusicDetail> findDetail(long id);
    List<NeighborTrack> findNeighbors(long id, int k);  // 자기 제외, distance ASC, id ASC, 재생불가 포함
}
```

- 어댑터 = MyBatis `MusicDetailMapper`(B-D 후). 시그니처는 BE4 합의 대상.
- `findDetail` empty → 서비스가 `MUSIC_NOT_FOUND`(404). `findNeighbors`는 후보가 k 미만이면 있는 만큼.

## 에러 코드

| code | HTTP | 출처 |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | master `GlobalErrorCode` |
| `MUSIC_NOT_FOUND` | 404 | 신규 `MusicErrorCode`(BE2) |
| (401) | 401 | B-A 대기 |
| `INTERNAL_SERVER_ERROR` | 500 | master `GlobalErrorCode` |

## 불변식

- 상세·주변곡 `location`은 baseline `v2.1-pca16` 고정값(진입 경로 무관 동일).
- `neighbors`에 상세 대상 곡 `id`는 없다(자기 제외).
- `neighbors` ≤ 10, distance 오름차순(동률 id 오름차순), 재요청 시 동일 순서.
