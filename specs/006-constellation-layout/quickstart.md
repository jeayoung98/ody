# Quickstart: 별자리 배치 검증

계약은 [contracts/constellation-layout.md](contracts/constellation-layout.md), 계산 규칙은 [data-model.md](data-model.md) 를 본다. 여기서는 **무엇을 돌려 무엇을 확인하는지**만 적는다.

## 전제

- 투영 계산(`PlanarProjection`)은 Spring·DB 없이 직접 호출한다. 좌표는 테스트가 만든 값이다.
- 서비스는 `MusicDetailReader` 를 fake 로 주입한다. **호출 횟수를 세는 fake** 여야 한다(왕복 1회 검증).
- 컨트롤러는 standalone MockMvc + `GlobalExceptionHandler`. 기존 `MusicDetailControllerTests` 와 같은 방식.
- 실 DB 검증(좌표 일괄 조회 SQL)은 어댑터 테스트에서 한다 — 기존 `MusicDetailReaderAdapterTests` 옆에 붙인다.

## 시나리오 (spec Acceptance ↔ 검증)

### 투영 단위 (`PlanarProjectionTests`)

| # | Given | When | Then | FR |
| --- | --- | --- | --- | --- |
| Q1 | 곡 10개, 서로 다른 16D 좌표 | 두 번 투영 | 두 결과가 `double` 비트까지 동일 | FR-004 |
| Q2 | 같은 10개를 **역순·셔플**로 | 투영 | 각 `musicId` 의 `x`·`y` 가 Q1 과 동일 | FR-005 |
| Q3 | 임의 집합 | 투영 | 모든 `\|x\|,\|y\| ≤ 1` 이고, 적어도 한 점이 한 축에서 `\|값\| == 1` | FR-007 |
| Q4 | 모든 곡의 좌표가 동일 | 투영 | 전부 `(0,0)`, 예외 없음 | FR-008 |
| Q5 | 곡들이 한 직선 위(2번째 축 분산 0) | 투영 | 예외 없음, 두 번째 축 좌표가 전부 0 | Edge |
| Q6 | 곡 2개 | 투영 | 한 축 위 `-1`, `1` 두 점 | Edge |
| Q7 | 한 차원(pc3)에서만 값이 다른 곡 3개(-5, 0, +5) — 주축이 그 차원으로 고정된다 | 투영 | 부호 규약("절댓값 최대 성분을 양수로")대로면 pc3 가 큰 곡의 x 도 크다. 기대값 `-1`, `0`, `1` 을 하드코딩해 규약을 못 박는다 — 규약이 없으면 좌우가 뒤집혀도 테스트가 통과한다 | FR-006 |
| Q8 | 입력 배열 | 투영 | 입력 배열이 변형되지 않았다 | FR-002 |

### 서비스 (`ConstellationServiceTests`)

| # | Given | When | Then | FR |
| --- | --- | --- | --- | --- |
| Q9 | fake reader 가 4곡 좌표 반환 | 4곡 요청 | 200 상당 결과, `points` 4개, 요청 순서대로 | FR-001, FR-009 |
| Q10 | fake reader 호출 횟수 카운트, 곡 30개 | 30곡 요청 | `findLocationsByIds` **1회** 호출 (곡당 호출 아님) | FR-011, SC-003 |
| Q11 | fake reader 가 요청 4개 중 3개만 반환 | 4곡 요청 | `MUSIC_NOT_FOUND` 예외. 3곡짜리 부분 결과를 만들지 않는다 | FR-014 |
| Q12 | `musicIds` = `[1]` / `[]` / 31개 / `[7,7]` | 요청 | `INVALID_INPUT` | FR-013 |
| Q13 | reader 미주입(`Optional.empty`) | 요청 | 명시적 실패 — 조용히 빈 배치를 내지 않는다 | — |

### 컨트롤러 (`ConstellationControllerTests`)

| # | Given | When | Then | FR |
| --- | --- | --- | --- | --- |
| Q14 | 정상 4곡 | `POST /api/constellations/layout` | 200, `{success:true, data.points[4], error:null}` | FR-001 |
| Q15 | 본문에 `points`(16D 좌표)를 **함께** 실어 보냄 | 같은 요청 | 응답이 Q14 와 완전히 동일 | FR-003 |
| Q16 | `musicIds` 누락 | POST | 400 `INVALID_INPUT` | FR-013 |
| Q17 | 없는 곡 포함 | POST | 404 `MUSIC_NOT_FOUND`, `data:null` | FR-014 |

### 어댑터 (`MusicDetailReaderAdapterTests` 에 추가)

| # | Given | When | Then | FR |
| --- | --- | --- | --- | --- |
| Q18 | id 3개 | `findLocationsByIds` | 매퍼 호출 1회, 결과 Map 의 키가 존재하는 id 만 | FR-011, R5 |
| Q19 | 없는 id 포함 | 같은 호출 | 예외 없이 그 키가 빠진다 | R5 |

## 실행

```bash
cd backend && ./gradlew test --tests '*Constellation*' --tests '*PlanarProjection*'
```

전체 검증(완료 보고 전 필수):

```bash
cd backend && ./gradlew test && ./gradlew build
```

## 수동 확인 (선택)

백엔드를 띄운 뒤 Swagger(`/api/swagger-ui.html`)나 curl 로 같은 요청을 두 번, 그리고 순서를 섞어 한 번 더 보낸다.
세 응답의 곡별 `x`·`y` 가 같아야 한다.

```bash
curl -sS -X POST http://localhost:8080/api/constellations/layout \
  -H 'Content-Type: application/json' \
  -d '{"musicIds":[10234,88123,4412,900001]}'
```

## 아직 검증하지 않는 것

- **SC-002 (1초)**: k6 smoke 이후 측정한다. 단위 테스트로는 확인되지 않는다. 잠정 기준이므로 **첫 실측값을 기록해 기준을 다시 정한다** — 여유가 크면 더 빡빡한 값으로 바꾼다.
- **SC-004 (플레이리스트 상세 왕복 1회)**: Phase B(US2) 를 구현한 뒤 `PlaylistServiceTests` 로 확인한다.
- **401**: `SecurityConfig` 가 한시 해제 상태다(S15P21A405-243, 원복 이슈 S15P21A405-245). 원복 후 확인한다.
