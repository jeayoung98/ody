# Contract: 이웃곡 조회 — BE3 소비자 관점

**Spec**: [../spec.md](../spec.md) FR-070, FR-078 | **Date**: 2026-09-10 | **소유**: **BE2 Discovery** (BE3는 소비자) | **정본**: Notion `GET /music/neighbors` (담당 박지원 — 담당은 BE3지만 소유는 BE2로 명시됨)
**상태**: 초안. R-02·R-03 협의 전.

## 1. 계약 의미 (정본 + 기존 `MusicDetailReader` 주석 — 두 출처가 일치)

기준 곡과 16차원 벡터 공간에서 가까운 곡 K개를 거리 오름차순으로 반환한다.

| 규칙 | 근거 |
| --- | --- |
| `distance` 오름차순, 동률 id 오름차순 | `MusicDetailReader.findNeighbors` 주석 |
| 기준 곡 자신 제외 | 양쪽 |
| `location` NULL 곡 제외 | Notion |
| 재생 불가(`youtube_url` NULL) 곡 **포함** | `MusicDetailReader` 주석 — 근처 사람 표시에는 재생 여부 무관 |
| 후보 < K면 있는 만큼 | `MusicDetailReader` 주석 |
| 거리 = 서빙 baseline(v2.1-pca16) **원시 pc값**. 정규화 좌표 금지 | 양쪽 |
| **결과 불변** — 같은 `(musicId, k)`는 항상 같은 결과 | Notion → 응답 캐시 가능, 데이터셋 버전 승격 시만 플러시 |
| 사전 계산 KNN 테이블 없음, pgvector 즉시 계산 | Notion |

## 2. BE3가 소비하는 형태 (R-02 결정)

**인프로세스 포트** — `com.ssafy.backend.music.detail.MusicDetailReader#findNeighbors(long id, int k): List<NeighborTrack>`

- BE3 `NearbyService`는 이 인터페이스만 의존한다. 어댑터(MyBatis + pgvector)는 BE2/BE4 구현(B-3).
- BE3가 필요한 필드: `musicId`, `distance`. 그룹 헤더용 `title`, `artist`와 좌표(`location`)는 별도 조회(§3).
- 개발 중에는 `@Profile("realtime-dev")` 고정 결과 스텁으로 대체해 US3를 진행한다.

**REST `GET /music/neighbors?musicId&k`** — BE2가 외부·디버깅용으로 노출. BE3 런타임 의존 아님.

```json
{ "success": true,
  "data": { "musicId": 10234,
            "neighbors": [ { "musicId": 10877, "distance": 0.0412 },
                           { "musicId": 20415, "distance": 0.0533 } ] },
  "error": null }
```

에러: `MUSIC_NOT_FOUND` 404, `VALIDATION_ERROR` 400. `k` 기본 10(BE3 yml `realtime.nearby.neighbor-k`와 동일 값 유지).

## 3. 추가 요청 — 경량 좌표·메타 포트 (R-03) **[BE2]**

실시간 경로에서 곡 1건의 좌표를 매 `/music/play`마다, 근처 스냅샷에서 K+1곡의 title/artist/좌표를 읽어야 한다. `findDetail`(상세 전체)은 과하다.

제안 시그니처 (BE2 소유 패키지에, BE3는 인터페이스만 의존):

```java
public interface MusicLocationReader {
    /** location NULL이면 Optional.empty가 아니라 present + isMappable()=false로 구분 (곡 부재와 location NULL을 나눠야 함) */
    Optional<MusicLocation> findLocation(long musicId);        // MusicLocation { long id; double[] pc /*16*/; String title; String artist; boolean mappable; }
    List<MusicLocation> findLocations(Collection<Long> ids);   // 배치, 순서 무관
}
```

- 좌표 불변 → BE3가 프로세스 내 캐시(상한형). 데이터셋 버전 승격 시 플러시 훅 필요 — 승격 이벤트/버전 식별자 노출 방식은 BE4와(헌법 V·VII, COORDINATE_MIGRATION TODO).

## 4. 협의 항목

- [ ] Notion 남은 협의 #1: 레이어·영역 필터를 `/music/neighbors` **쿼리 안**(WHERE 누적)에서 할지 **BE3 후처리**로 할지. BE3 관점: 후처리(정본 RT-10은 이웃곡 K개를 레이어 무관하게 가져와 청취자를 붙인다 — 필터가 들어가면 "이웃 K개"의 의미가 레이어마다 달라져 캐시 불변성이 깨진다). **후처리 없음**을 제안 — 근처 사람은 레이어 무관(RT-50 만남과 동일 원칙).
- [ ] `NeighborTrack`에 `distance` 필드 존재 확인
- [ ] `MusicLocationReader` 수용 여부·패키지 위치
- [ ] 어댑터 구현 시점(B-3) — 그 전까지 BE3는 스텁으로 개발
