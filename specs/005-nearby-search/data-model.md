# Data Model: 기준점 주변 곡 탐색 (005)

**작성**: 2026-09-13 | **입력**: [spec.md](./spec.md) · [research.md](./research.md)

이 기능은 **저장소 스키마를 바꾸지 않는다.** 아래는 요청·응답·내부 표현의 모양이다.

---

## 1. 기준점 (Center) — 요청 입력

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `id` | long | 배타 택1 | 1 이상. 곡 기준 |
| `pc1`~`pc16` | double x16 | 배타 택1 | 16개 전부. 지점 기준 |

- `id` 와 좌표 중 **정확히 하나**여야 한다. 둘 다 또는 둘 다 아님 -> 400 (R1)
- 좌표는 보정하지 않는다. 어느 곡과도 일치하지 않아도 그대로 질의 좌표로 쓴다 (FR-011)

## 2. 응답 — `NearbyResponse`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `center` | `NearbyCenter` | 기준점. 곡 기준이면 그 곡의 요약, 좌표 기준이면 좌표만 |
| `neighbors` | `NeighborTrack[]` | 최대 10. 거리 오름차순, 동률 시 id 오름차순 |
| `lowSimilarity` | boolean | 마지막 이웃 거리 > `tauFar`. 이웃 0곡이면 `true` |

### 2-1. `NearbyCenter`

| 필드 | 타입 | 곡 기준 | 좌표 기준 |
| --- | --- | --- | --- |
| `id` | Long | 그 곡의 id | `null` |
| `title` | String | 곡 제목 | `null` |
| `artist` | String | 아티스트 | `null` |
| `location` | `Location` | 그 곡의 좌표 | 받은 좌표 |

`location` 은 두 경우 모두 채워진다 — 프론트가 선 연결·중심 표시에 쓴다(FR-004).

### 2-2. `NeighborTrack` — **기존 것을 그대로 쓴다**

`@JsonUnwrapped MusicSummary` + `distance`. 003 의 `neighbors` 원소와 **같은 타입**이다. 두 진입점이 같은 모양을 내보내야 하므로 새로 만들지 않는다.

`MusicSummary` = `id · title · artist · album · genres · youtubeUrl · location`

## 3. 곡 상세(003) 응답 변경

`MusicDetailResponse` 에 **`lowSimilarity`(boolean) 추가**. `neighbors` 원소 스키마는 그대로이고, **담기는 곡이 달라진다**(선정 규칙 적용).

> 배포된 계약 변경이다. api-spec §3.2 갱신과 프론트 통보가 따른다 — 통보는 2026-09-13 완료.

## 4. 내부 표현

### 4-1. `TrackCandidate` — 재사용, 손대지 않는다

`id · mbid · title · artist · duration · vec(float[16]) · dist`

선정에 필요한 것이 이미 다 있다: 중복 판정(title·artist), 길이 규칙(duration), 정렬(dist·id). **앨범·장르는 일부러 없다** — 후보 40건에 조인을 걸지 않기 위해서다(R5).

### 4-2. `NeighborSelection` — 신설, 이 기능의 본체

순수 함수. 저장소를 모른다.

```text
select(candidates, queryVec, queryTrack, rules, limit) -> List<TrackCandidate>
```

| 입력 | 뜻 |
| --- | --- |
| `candidates` | 후보 (거리 오름차순, 근사라 순서가 흔들릴 수 있음) |
| `queryVec` | 기준점 좌표 |
| `queryTrack` | 기준점이 곡일 때 그 곡. 좌표 기준이면 `null` |
| `rules` | `ServingRules` |
| `limit` | 10 (후보는 40을 넘긴다) |

**판정 순서** (거리 오름차순으로 훑으며, 하나라도 걸리면 건너뛴다):

| # | 조건 | 근거 |
| --- | --- | --- |
| 1 | 기준점 곡 자신 | FR-006 |
| 2 | `dist < rules.tauDup` | FR-018 (a) 기준점과 같은 녹음 |
| 3 | 기준점 곡과 같은 `(artist,title)` 키 | FR-018 (c) |
| 4 | 이미 담은 이웃과 같은 키 | FR-018 (b) |
| 5 | 같은 아티스트가 `rules.artistCap` 이상 (**아티스트가 비어 있으면 세지 않는다**) | FR-019 |
| 6 | `duration` 이 길이 범위 밖 | FR-020, `rules.lengthAllowed()` |

10곡이 차면 중단. 마지막에 `(distance, id)` 안정 정렬(FR-008, R10).

- 키 정규화는 `SameRecording.key()` — `lower(trim(title))` + `lower(trim(artist))`. **둘 중 하나라도 비면 `null`** 이고 null 키는 서로 같지 않다(제목 빈 곡 3,977개)
- 아티스트 비교도 같은 정규화를 쓴다. 원문 비교는 대소문자·공백으로 상한을 빠져나간다(R8)
- **아티스트가 빈 문자열이면 상한 카운트에서 빼고 통과시킨다.** 운영에 14,862건(0.22%) 있고, 한 덩어리로 세면 무관한 곡들이 자리 3개를 나눠 갖는다 — `SameRecording` 이 빈 키를 `null` 로 두는 것과 같은 이유다
- `duration` 이 `null` 이면 길이 규칙을 적용하지 않고 통과시킨다(`ServingRules.lengthAllowed` 의 기존 동작)

### 4-3. `ServingRules` — 재사용, 손대지 않는다

`@ConfigurationProperties("ody.serving")`. 좌표계 버전(`bundle`)에 묶인 임계값 묶음.

| 값 | 기본 | 쓰는 곳 |
| --- | --- | --- |
| `tauDup` | 1.6624 | 판정 2 |
| `artistCap` | 3 | 판정 5 |
| `tauFar` | 4.912 | `lowSimilarity` |
| `lengthMinS`/`lengthMaxS` | 30 / 1200 | 판정 6 |

값의 유일한 출처는 `data/serving/<bundle>/postprocess_rules.json` 이다. Java 상수로 박지 않는다(FR-022).

## 5. 저장소

**변경 없음.** `music` 테이블과 HNSW 인덱스를 읽기만 한다. 마이그레이션 없음.

| 읽는 것 | 어디서 |
| --- | --- |
| 기준 곡 좌표 | `MusicDetailMapper.findLocationText(id)` (기존) |
| 후보 40 | `NearestTrackMapper.findNearest(point, limit)` (기존) |
| 확정 10곡의 앨범·장르 | 기존 상세·장르 조회 (기존) |
