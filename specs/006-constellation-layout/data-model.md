# Phase 1 Data Model: 별자리 배치

**Feature**: 006-constellation-layout | **Date**: 2026-09-13

새 테이블·새 컬럼·마이그레이션이 없다. 기존 `music.location` 을 읽어 응답 DTO 로 바꾸는 것이 전부다.

## 저장소 (변경 없음)

| 대상 | 내용 |
| --- | --- |
| `public.music` | `id bigint`, `location vector(16)` 사용. 6,624,399행 적재 완료 |
| 좌표 버전 | 서빙 baseline `v2.1-pca16`. 이 기능은 읽기만 하고 재계산하지 않는다 |
| 인덱스 | `id` PK 로 충분하다. HNSW 거리 인덱스(`music_location_hnsw_idx`)는 쓰지 않는다 — KNN 이 아니라 지정 id 조회다 |

## 엔티티

### Location (기존, `music/dto/Location.java`)

곡 1개의 16차원 서빙 좌표 `pc1..pc16`. 그대로 재사용한다. `toArray()` 로 `float[16]` 을 얻는다.

**검증**: 이 기능은 값 자체를 검증하지 않는다. 행이 없거나 좌표가 NULL 이면 "없는 곡"으로 취급한다(FR-014).

### ConstellationPoint (신규)

곡 1개의 배치 좌표.

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `musicId` | `long` | 요청한 id 그대로 |
| `x` | `double` | `-1.0 ≤ x ≤ 1.0` (FR-007) |
| `y` | `double` | `-1.0 ≤ y ≤ 1.0`. 위가 양수 |

프론트 `types/constellation.ts` 의 `ConstellationPoint` 와 필드명·의미가 같다.

### ConstellationLayoutResponse (신규)

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `points` | `List<ConstellationPoint>` | 요청 `musicIds` 와 **같은 개수, 같은 나열 순서**(FR-009). 누락 없음 — 하나라도 못 채우면 404 다 |

### ConstellationLayoutRequest (신규)

| 필드 | 타입 | 검증 |
| --- | --- | --- |
| `musicIds` | `List<Long>` | `@NotNull`, 크기 2~30, 각 원소 `@Min(1)`, **중복 금지** (FR-013) |

**요청 본문의 나머지 필드는 무시한다.** 프론트가 지금 함께 보내는 `points`(16차원 좌표)는 매핑하지 않는다(FR-003). Jackson 기본 설정상 모르는 필드는 무시되므로 프론트 수정 전에도 붙는다.

## 상태 전이

없다. 조회 전용이며 어떤 도메인에도 쓰지 않는다(FR-016).

## 계산 모델 (`PlanarProjection`)

입력: `List<(musicId, double[16])>` · 출력: `Map<Long, (x, y)>`

1. **정렬** — `musicId` 오름차순. 부동소수 합의 순서를 고정해 입력 순서 무관성을 만든다(R2).
2. **중심 이동** — 차원별 평균을 빼 `X`(n×16) 를 만든다.
3. **공분산** — `C = XᵀX / n` (16×16 대칭).
4. **고유분해** — Jacobi 회전. 고유값 내림차순 정렬, 동률이면 인덱스 오름차순(R1, R3).
5. **부호 규약** — 각 고유벡터에서 절댓값 최대 성분(동률이면 낮은 인덱스)을 양수로 만든다(R3).
6. **투영** — `x = X·v1`, `y = X·v2`.
7. **정규화** — `span = max(|x|, |y|)` 전체 최댓값. `span < 1e-9` 면 전부 `(0,0)`, 아니면 `x/span`, `y/span` (R4).

**불변식**

- 같은 `(musicId, 좌표)` 집합 → 비트 단위 동일 출력 (FR-004, FR-005)
- 모든 출력이 `[-1, 1]`, 그리고 `span ≥ 1e-9` 인 경우 적어도 한 점이 어느 한 축에서 `|값| == 1` (FR-007)
- 입력 좌표를 변형하지 않는다 (FR-002)

**알려진 한계**: 고유값이 정확히 동률이면 두 번째 축 선택이 임의다. 결정적으로는 고르되 "그 집합의 모양" 보장은 그 경우 약해진다 (R3).

## 조회 port 변경

`MusicDetailReader` (기존 인터페이스, BE2 소유)

```text
Map<Long, Location> findLocationsByIds(List<Long> ids)
```

- **한 번의 조회**로 처리한다. 곡당 왕복 금지 (FR-011, SC-003)
- **없는 id 는 결과에 키가 없다** (예외 아님). 누락 판정은 호출자 책임 — `JourneyTrackReader` 와 같은 계약
- 순서를 보장하지 않는다 (Map 이므로 자명)
- 부수효과 없음
- 최대 30건

SQL 은 `MusicDetailMapper.xml` 의 `locationColumns` 조각을 재사용한다. 제목·아티스트·장르는 읽지 않는다.
