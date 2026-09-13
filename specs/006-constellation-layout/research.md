# Phase 0 Research: 별자리 배치

**Feature**: 006-constellation-layout | **Date**: 2026-09-13

Technical Context 의 미해결 항목과, "같은 곡 집합이면 항상 같은 모양"(FR-004~FR-006)을 실제로 보장하는 방법을 정리한다.

---

## R1. 16차원을 2D 로 누르는 방법

**Decision**: 요청 집합의 16×16 **공분산 행렬**을 만들고, **Jacobi 회전법**으로 고유분해해 고유값 상위 2개의 고유벡터에 투영한다.

**Rationale**:
- 곡 집합의 분산이 가장 큰 두 방향 = 그 집합의 모양을 가장 덜 뭉개는 평면이다. 프론트 목이 이미 같은 계열(공분산 상위 2축)이라 모양의 성격이 바뀌지 않는다 — 배치 API 가 붙었을 때 화면이 "다른 앱처럼" 보이지 않는다.
- 차원이 16 고정이라 행렬 크기가 입력과 무관하다. 곡 30개든 2개든 16×16 한 번이다.
- Jacobi 는 대칭 행렬에 대해 항상 수렴하고, 비대각 성분 크기로 수렴을 판정한다. 반복 횟수를 상수로 박지 않아도 된다.
- 외부 의존성이 필요 없다 — `backend/build.gradle` 에 선형대수 라이브러리가 없다.

**Alternatives considered**:
| 대안 | 기각 이유 |
| --- | --- |
| 거듭제곱 반복 + 디플레이션 (프론트 목 방식) | 코드는 더 짧지만 **반복 횟수에 결과가 의존한다**. 목은 40회 고정이다. 상위 두 고유값이 가까우면 40회로 수렴하지 않아 축이 시작 벡터 쪽으로 치우친다 — 결정적이긴 해도 "그 집합의 모양"이 아니게 된다 |
| Apache Commons Math `EigenDecomposition` | 16×16 하나 풀자고 새 의존성을 넣는다. 배포 이미지·버전 관리 비용이 50줄보다 크다 |
| 고전 MDS (거리 행렬 기반) | 거리 행렬이 n×n 이라 곡 수에 따라 비용이 커지고, 결과는 PCA 와 (유클리드 거리에서) 같은 평면이다. 얻는 것 없이 계산만 늘어난다 |
| 전역 고정 축(pc1·pc2)으로 투영 | 계산이 없어 가장 싸지만, 곡들이 지도 한구석에 몰려 있으면 전부 한 점으로 뭉친다. "별자리 모양"이 안 나온다. A-9 이 요구하는 것도 레이어(=고정 축)와 **무관한** 모양이다 |

---

## R2. 순서를 바꿔도 같은 좌표가 나오게 하는 법

**Decision**: 좌표를 누적하기 전에 곡을 **`musicId` 오름차순으로 정렬**한다.

**Rationale**: 수학적으로는 공분산이 순서와 무관하지만, `double` 덧셈은 결합법칙이 성립하지 않는다. 요청 순서대로 더하면 `[A,B,C]` 와 `[C,B,A]` 의 평균·공분산이 마지막 비트에서 달라지고, 그 차이가 고유벡터를 통해 확대돼 좌표가 미세하게 흔들린다. 정렬 한 번으로 입력 순서와 무관하게 **같은 덧셈 순서**를 강제한다.

**Alternatives considered**: 오차 보상 합(Kahan) — 정확도는 올라가지만 "순서 무관"을 보장하지는 않는다. 정렬이 더 싸고 확실하다. 응답의 나열 순서는 별개로 요청 순서를 따른다(FR-009).

---

## R3. 축 부호 — 뒤집힌 모양 방지

**Decision**: 고유벡터 `v` 마다 **절댓값이 가장 큰 성분(동률이면 낮은 인덱스)을 양수로** 만드는 부호 규약을 적용한다.

**Rationale**: 고유벡터는 `v` 와 `-v` 가 모두 해다. 어느 쪽이 나오는지는 수치 알고리즘 내부 사정이라, 규약 없이는 같은 곡 집합이 좌우/상하 뒤집힌 모양으로 나올 수 있다. 이 규약은 벡터 값만으로 결정되고 곡 순서·구현과 무관하다.

**Alternatives considered**: 투영값의 왜도(skewness) 부호로 맞추는 방식 — 통계적으로는 더 "자연스럽지만" 왜도가 0 근처면 다시 불안정하다. 곡 id 최솟값이 1사분면에 오게 하는 방식 — 그 곡이 원점 근처면 불안정하다.

**Known ceiling**: 고유값이 정확히 같으면(λ2 == λ3) 어느 축을 2번째로 고를지 수학적으로 정할 수 없다. 실수 좌표에서 정확한 동률은 사실상 나오지 않지만, 구현은 "고유값 내림차순, 동률이면 인덱스 오름차순" 으로 결정적으로 고르고 이 한계를 주석에 남긴다.

---

## R4. 정규화 방식

**Decision**: 두 축의 투영값을 모아 `span = max(|x|, |y|)` 를 구하고, `x`·`y` 를 **같은 `span` 으로** 나눈다. `span` 이 0 에 가까우면(`< 1e-9`) 모든 점을 `(0, 0)` 으로 둔다.

**Rationale**: 축마다 따로 정규화하면 분산이 작은 두 번째 축이 억지로 늘어나 모양이 찌그러진다 — 한 줄로 늘어선 플레이리스트가 동그랗게 보인다. 공통 배율이어야 "모양"이 보존된다. 프론트 목도 같은 방식이라 화면 결과가 연속적이다.

**Alternatives considered**: 축별 min-max 정규화(모양 왜곡), 표준편차 기준 정규화(바깥 점이 1 을 넘어 화면 밖으로 나간다).

---

## R5. 곡 좌표 일괄 조회를 어디에 붙이나

**Decision**: **새 port 를 만들지 않는다.** 기존 `MusicDetailReader` 에 `Map<Long, Location> findLocationsByIds(List<Long> ids)` 를 더하고, `MusicDetailReaderAdapter` 가 구현한다. SQL 은 `MusicDetailMapper.xml` 에 `id IN (...)` select 하나를 더하고 기존 `locationColumns` 조각을 재사용한다. 결과 매핑은 기존 `MusicDetailRow` 를 그대로 쓴다(`toLocation()` 이 이미 있다).

**Rationale**: 같은 테이블, 같은 컬럼, 이미 있는 어댑터·row DTO·SQL 조각이다. 새 인터페이스·새 어댑터·새 Bean·새 row 클래스를 만들면 좌표 컬럼 조각이 두 벌이 된다 — `JourneyTrackReader` 가 별도 매퍼를 두지 않은 이유와 같다.

**Alternatives considered**: 별도 `TrackLocationReader` port 신설 — `JourneyTrackReader` 선례가 있어 일관성 주장은 가능하나, 그쪽은 `MusicDetail` 전체를 mbid 로 읽는 **다른 질의**였다. 여기는 같은 id 조회에 컬럼만 줄인 것이다.

**반환형 주의**: `Map<Long, Location>` 이라 **요청한 id 중 없는 것은 키가 없다**. 호출자가 `keySet()` 으로 누락을 잡아 404 를 낸다(FR-014). 조용히 빠지지 않는다.

---

## R6. 없는 곡·중복·개수 위반의 처리

**Decision**:

| 입력 | 응답 |
| --- | --- |
| `musicIds` 누락·빈 배열·1개 | 400 `INVALID_INPUT` |
| 31개 이상 | 400 `INVALID_INPUT` |
| 같은 id 중복 | 400 `INVALID_INPUT` |
| 존재하지 않는 id 포함 | 404 `MUSIC_NOT_FOUND` |
| 좌표(`location`)가 NULL 인 행 | 404 `MUSIC_NOT_FOUND` (위와 같이 다룬다) |

**Rationale**: 003-music-detail 이 정한 "부분 결과를 성공으로 내지 않는다" 를 따른다. 곡 하나가 빠진 채 200 을 주면 모양이 조용히 달라지고, 호출자는 그걸 알 방법이 없다. 중복도 마찬가지로 조용히 합치지 않는다(헌법 VI).

**Alternatives considered**: 없는 곡을 빼고 200 + `missingIds` 를 함께 내려주는 방식 — 프론트가 그 필드를 처리하지 않으면 결국 조용한 실패와 같다. 필요해지면 계약 변경으로 다시 논의한다.

**기존 코드와의 정합**: `MusicErrorCode.MUSIC_NOT_FOUND`(404), `GlobalErrorCode.INVALID_INPUT`(400) 이 이미 있다. 새 오류 코드를 만들지 않는다.

---

## R7. 인증

**Decision**: 다른 음악 API 와 같은 규칙을 따른다 — 공개 경로 목록에 넣지 않는다.

**주의**: 현재 `SecurityConfig` 는 `.anyRequest().permitAll()` 이다. FE 연동 테스트용 **한시 해제**(S15P21A405-243)이며 원복 이슈가 열려 있다(S15P21A405-245). 이번 기능은 그 해제에 아무것도 더하지 않는다 — 원복되면 자동으로 인증 필요 상태가 된다. 배치 결과는 사용자별로 달라지지 않으므로 `Authentication` 주체를 읽지 않는다.

---

## R8. 경로 표기

**Decision**: `POST /api/constellations/layout`. BACKEND-NOTES A-9 와 프론트 상수(`API_ENDPOINTS.constellation.layout`)가 이미 이 값이다.

**미해결**: 백엔드 다른 도메인은 단수형(`/api/music`, `/api/playlist`)이다. 표기 통일은 S15P21A405-213(음악 API 접두사 정렬)·214(FE 상수 맞추기) 범위이며, 여기서 임의로 바꾸면 프론트가 두 번 고쳐야 한다. **바꾸려면 FE 와 함께 바꾼다.**

---

## R9. 플레이리스트 N+1 (US2)

**확인된 사실**: `PlaylistDetailResponse.musics` 는 `List<MusicDetail>` 이고 `MusicDetail.location` 이 pc1~pc16 이다 — **좌표는 이미 내려간다.** 프론트가 보는 목(`mockPlaylists`)이 안 실을 뿐이다.

**문제**: `PlaylistService.loadMusicDetails` 가 `musicIds` 를 for 로 돌며 `findDetail` 을 곡당 1회 호출한다. 30곡이면 30왕복이다.

**Decision**: 곡 상세 일괄 조회(`id IN`)를 쓰고 `musicIds` 순서로 재조립한다(FR-012). `playlist/` 는 BE1(Core) 소유지만 **2026-09-13 합의로 이번 이슈 범위에 포함한다** — 커밋은 분리한다(plan.md 경계 절).

**주의**: 일괄 조회는 순서를 보장하지 않는다 — `JourneyTrackReader` 계약이 같은 이유로 "순서 미보장, 호출자가 재조립" 을 명시하고 있다. 같은 규칙을 적용한다.
