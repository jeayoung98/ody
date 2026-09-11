# Contract: GET /api/music/major (대표곡 조회)

**Spec**: [../spec.md](../spec.md) | **정본**: [docs/api-spec.md §3.4](../../../docs/api-spec.md) | **Date**: 2026-09-08

⟲ **2026-09-11 D15~D19 로 재작성.** 원안(중심좌표·원형 구역·`youtubeCnt` DESC·`MusicDetail` 응답)은
[spec.md "대체된 요구사항 — 롤백 기록"](../spec.md) 절에 전문 보존돼 있다.

⚠️ **정본 `docs/api-spec.md` §3.4 는 아직 원안이다.** 이 문서와 어긋나며 갱신은 T036 담당이다(헌법 II).
확정된 부분만 규범으로 적고, 미정은 표시한다(설계로 확정하지 않음).

## 1. Request (D19 확정)

`GET /api/music/major` · 인증 필요.

| 항목 | 값 |
| --- | --- |
| Header | `Authorization: Bearer {accessToken}` (FR-002). 2026-09-10 dev `c820b53` 기본 거부 전환으로 `/music/**` 에 적용됨 |
| `level` | int, required. 조회할 레이어 |
| 누적 축 범위 | **level≥2 에서 required.** 레이어 1..level-1 각각의 사각 범위. 1레이어는 파라미터 없음 |

**레벨 ↔ 축 매핑(FR-003 확정, D15~D19 에서 변경 없음)**: 레이어 n → 평면 `pc(2n-1)`·`pc(2n)`.
level=1 → pc1·pc2, level=2 → pc3·pc4.

**누적 전달(D19 확정)**: 클라이언트가 이전 겹들의 범위를 캐싱해 전부 보낸다. 레이어를 올라가면 폐기한다.
**서버는 탐색 상태를 보관하지 않는다** — 요청 하나로 완결된다. 이 누적이 FR-008 의
`candidate(N+1) ⊆ candidate(N)` 을 전달 계약으로 성립시킨다.
port 가 `accumulated.size() == level - 1` 을 강제한다(`MajorQuery`, T004).

**최상위(FR-004 확정)**: level=1 은 범위 없이 호출한다. 미리 계산한 정적 결과(`map_sample`)를 반환한다.

### 미정
- 범위 파라미터의 이름·표기. BE2 제안은 `pc{n}min`·`pc{n}max`, FE1 은 "GET 으로 받는다"까지 확정. **설계가 아니라 표기 문제다**
- (P1/B1) 공개 지원 레벨 상한, level 생략 동작, 축 번호 범위·`min > max`·비유한 수의 오류 규칙

## 2. Success Response (D18 확정)

200, 공통 성공 포맷(FR-005). 항목은 **`MapPoint`** 다 — 정본 §0.6 `MusicDetail` 이 아니다.

```json
{ "success": true, "data": { "content": [ {
  "musicId": 10234,
  "pc": [-0.4213, 1.0872, "...", -0.123],
  "genreId": 0, "weight": 0,
  "title": "...", "artist": "...", "playable": false
} ] }, "error": null }
```

| 필드 | 계약 |
| --- | --- |
| `musicId` | `music.id` (BIGINT, 1..6,624,399) |
| `pc` | **정확히 16개** 배열. 클라이언트가 레이어 축으로 재투영하므로 전부 싣는다(D7 PCA-16) |
| `genreId` | **비음수 정수(MUST)**. FE `draw-map.ts` 의 `spr[genreId % len]` 이 raw modulo 라 음수면 `drawImage` 예외 |
| `weight` | 별 크기·밝기·클라이언트 선별용. 인기 지표 부재로 **현재 균일값**(D17) |
| `title` / `artist` | 표시용. `artist` 는 null 가능 |
| `playable` | 재생 링크 유무. `youtube_url` 전 행 NULL 이라 **현재 전부 false** |

`ghostOnly` 는 FE 타입이 "목 확인용" 이라 명시하므로 **서버가 보내지 않는다**(MUST NOT).
상세 필드(`bpm`·`duration`·`album`·`genres`·`mbid`·`playCnt`·`youtubeCnt`)는 `/music/{id}` 담당이다.
담으면 `map_sample` 이 조인을 없애 얻은 0.4 ms 이점이 사라진다.

**선정 규칙(D16 확정)**: 서버는 상주 집합을 **공간적으로 고르게** 뽑는다. 인기순 대표 선별은 하지 않는다 —
클라이언트가 화면 픽셀 격자(86px)에서 한다. 격자는 줌에 따라 변해 서버가 적용할 수 없다.
전역 상위 k 를 먼저 자른 뒤 범위로 거르지 않는다(MUST NOT, 원안에서 유지).

**크기**: 1000 이 규모 기준이다(D18). 정확한 수는 강제하지 않는다 — 1레이어 실측 1,094칸도 허용된다.

### 미정
- (P3/B4) 후보 0곡의 상태·본문. 빈 배열+200 을 명시한 근거가 없다
- `genreId` 무장르 인덱스 번호, 멜론 코드 29종 → FE 색 인덱스 매핑 (FE 구현 후 통보)

## 3. Error Contract (확정, 기존 재사용)

공통 실패 포맷: `{ "success": false, "data": null, "error": { "code", "message" } }` (FR-010).
기존 [GlobalExceptionHandler](../../../backend/src/main/java/com/ssafy/backend/common/GlobalExceptionHandler.java)·
[ErrorCode](../../../backend/src/main/java/com/ssafy/backend/common/ErrorCode.java) 재사용.

| 상황 | 상태 | code |
| --- | --- | --- |
| 타입 위반(`level=abc`, PC에 `abc`) 등 검증 실패 | 400 | `VALIDATION_ERROR` |
| 토큰 위조·무효 | 401 | `INVALID_TOKEN` |
| 토큰 만료 | 401 | `TOKEN_EXPIRED` |
| 토큰 없음 | 401 | 세부 코드 미명시(P3-c) → 상태·공통 실패 구조까지만 |
| 서버 내부 실패 | 500 | `INTERNAL_ERROR` |

후보 없음에 404·422를 적용하는 규칙은 원문에 없어 확정하지 않는다.

**master 통합(2026-09-09, M4/M5)**: 공통 계층은 master의 `ApiResponse.success/fail` + `ErrorCode`(인터페이스) + `CustomException`
+ `GlobalExceptionHandler`다. ⚠️ master 전역 `GlobalErrorCode`는 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`로, **api-spec §0.5의
`VALIDATION_ERROR`/`INTERNAL_ERROR`와 다르다(문서 충돌)**. music은 위 표의 계약 코드를 담은 자체 `ErrorCode` 구현 enum(`MusicErrorCode`)을
두어 계약을 지킨다. 전역 코드와의 정합은 BE1(공통 소유)·팀 결정. 또한 master `GlobalExceptionHandler`는 검증 예외(타입/누락/제약)를
매핑하지 않고 미처리 예외를 전역 `INTERNAL_SERVER_ERROR`로 반환하므로, 계약을 지키려면 핸들러 보완이 필요하다(F1/F2):
- 검증 예외 → **400 `VALIDATION_ERROR`** (A7)
- music 내부 실패 → **500 `INTERNAL_ERROR`** (A8; 전역 `INTERNAL_SERVER_ERROR`가 아니라 계약 코드로)

`INVALID_TOKEN`·`TOKEN_EXPIRED`는 인증 연동(B5) 시 추가.

## 4. 조회 port (T004 로 확정)

BE2(효정) 업무 로직과 데이터 조회 분리. **제안이 아니라 구현된 계약이다.**

```java
public interface MajorTrackReader {
    List<MapPoint> findResidentSet(MajorQuery query);
}
MajorQuery(int level, List<LayerBox> accumulated, int limit)
LayerBox(int layer, double xMin, double yMin, double xMax, double yMax)
```

구현(T005·T016)이 지킬 것 — 근거는 data 스펙 16 `ingest/map_layer_queries.sql` 실측이다.

| | |
| --- | --- |
| level=1 | 미리 계산한 `map_sample` 을 읽는다 (0.4 ms). 전역 실시간 집계는 20,941 ms |
| level≥2 | 1겹 범위에 표현식 GiST `point(...) <@ box(...)`, **2겹부터 `BETWEEN` heap 필터** (82~145 ms) |
| 금지 | `<@ box` 를 둘 이상 쓰면 `BitmapAnd` 로 145 → **355 ms**. 질의 벡터 서브쿼리는 recall **0.0000** |
| 금지 | 전역 상위 k 선절단 후 범위 필터 (FR-013 MUST NOT). 근사·ANN 대체 |
| 좌표 | 저장된 고정값 그대로. 재계산·재투영하지 않는다(FR-007) |

port 가 강제하는 불변식: `accumulated.size() == level - 1`, `LayerBox` 범위 역전 금지,
`MapPoint.pc` 16개, `MapPoint.genreId >= 0`.

## 5. 원본 동기화 필요 (T036 — 이 문서는 원본 미수정)

정본 `docs/api-spec.md` §3.4 가 원안이라 **이 문서와 호환 불가하게 어긋나 있다.** 헌법 II 는
"경계를 넘는 변경은 구현 전에 계약을 정의·갱신해야 한다(MUST)" 이므로 T005 착수 전에 갱신한다.

- §3.4 요청: 중심좌표 `pc1~pc16` → **`level` + 누적 축 범위**(1레이어는 파라미터 없음)
- §3.4 응답: `MusicDetail` 목록 → **`MapPoint` 7필드**
- §3.4 선정: 원형 내 `youtubeCnt` DESC 상위 k → **서버 공간 균등 / 클라이언트 인기순**
- §3.4 축 개수 변화 설명 → 레이어 n → PC(2n-1)·PC(2n) (C1/C4, D15 이전부터 필요했던 정정)

소비자 합의는 2026-09-11 FE1 확인으로 끝났다. 팀 공용 문서라 MR 리뷰어에 FE1·BE4 를 포함한다.
