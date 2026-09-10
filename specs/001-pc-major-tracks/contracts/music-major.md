# Contract: GET /music/major (대표곡 조회)

**Spec**: [../spec.md](../spec.md) | **정본**: [docs/api-spec.md §3.4](../../../docs/api-spec.md) | **Date**: 2026-09-08

기존 외부 계약을 보존한다. 확정된 부분만 규범으로 적고, 미정은 표시한다(설계로 확정하지 않음).

## 1. Request (확정)

`GET /music/major` · 인증 필요.

| 항목 | 값 |
| --- | --- |
| Header | `Authorization: Bearer {accessToken}` (FR-002) |
| `level` | int, required, 기본 1 (api-spec §3.4). 코드 `@Min(1)`은 정책 근거 아님 |
| `pc1`~`pc16` | float, not required (api-spec §3.4) |

**레벨 ↔ 축 매핑(FR-003 확정)**: 지원 레벨 n → 중심 축 `pc(2n-1)`·`pc(2n)`. level=1 → pc1·pc2, level=2 → pc3·pc4.
이전 단계 중심·장르 단계로 해석하지 않는다. `x/y`·별도 축 ID·PC별 min/max 같은 신규 필드를 추가하지 않는다.

**최상위 예외(FR-004 확정)**: level=1은 PC 값 없이 호출 가능. PC 생략만으로 `VALIDATION_ERROR` 아님. 이 허용을
다른 레벨로 확대하지 않는다.

### 미정 (P1/B1 — 설계로 채우지 않음)
- 공개 지원 레벨 상한, level 생략 시 동작(C3: required이면서 기본 1), level=0·음수·비정수.
- level>1에서 PC 한쪽 누락·두 축 외 PC 추가·다른 쌍 전달의 오류 규칙.
- 좌표 유효 범위·음수/0·NaN·Infinity·데이터 영역 밖 처리. **중심좌표를 임의 보정하지 않는다.**

## 2. Success Response (부분 확정)

200, 공통 성공 포맷(FR-005). 항목은 `MusicDetail`(§0.6). `location.pc1`~`pc16`은 곡의 고정 좌표(FR-007).

```json
{ "success": true, "data": { "content": [ {
  "id": 10234, "mbid": "b1a9c0e9-...", "title": "...", "artist": "...", "bpm": 128.4, "duration": 275,
  "album": "...", "genres": ["K-Pop"], "youtubeUrl": "https://...",
  "location": { "pc1": -0.4213, "...": "...", "pc16": -0.123 }, "playCnt": 1428, "youtubeCnt": 3
} ] }, "error": null }
```

**선정 규칙(FR-013 확정)**: 원형 영역 + 기존 탐색 제약을 만족하는 후보에서 `youtubeCnt` 내림차순 상위 k, 같은
순서 반환. 전역 top-k를 먼저 잘라 후보 내부 상위곡을 누락하지 않는다. `playCnt`는 순위에 사용하지 않으며 동결값.
`youtubeUrl: null`이어도 그 이유만으로 제외하지 않는다(FR-009).

### 미정 (P3/B4, C2 — 설계로 채우지 않음)
- k 확정값·레벨별 동일 여부(k=1000 잠정), 동률·null·중복·조회수 갱신 시 순서 일관성.
- 페이지 정보(`page/size/totalElements/...`) 적용 여부. api-spec §0.2/§0.3 목록 규약(page 크기 10) vs §3.4 `content`
  단독 예시 불일치(C2). **10/20을 대표곡 수로 채택하지 않는다.**
- 후보 0곡·k 미만의 상태·본문(빈 배열+200을 명시한 근거 없음).

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

## 4. BE4 조회 경계 제안 (`MajorTrackReader` port — 합의 전)

BE2(효정) 업무 로직과 BE4(재영) 조회 엔진 분리(team-roles §5·§12). 아래는 **제안**이며 승인 계약이 아니다.

- 입력: baselineVersion(v2.1-pca16), 현재 축 쌍·중심, 서버 반경, 누적 제약, k.
- 정확성 계약: "동일 버전 + 기존 제약 + 원형 내부" 전체 후보에 `youtubeCnt DESC` top-k. 근사·전역 선절단 금지.
- 반환: 선정 곡 ID를 순위 순서로. 메타데이터 복원은 선정 ID 순서 기준.
- **미정(B6)**: 실제 인터페이스 시그니처·스키마·ID 매핑·접근 권한. BE4의 기존 KNN/ANN은 유사도 top-k이므로 인기
  top-k 계약과 다름 — 그대로 대체하지 않는다.

## 5. 원본 동기화 필요 (spec에서 지시, 이 계획은 원본 미수정)

- api-spec §3.4: 요청 중심을 따라 이동하는 원형 구역·서버 레벨별 반경·반경 입력 미요구를 명시(Q2~Q4).
- api-spec §3.4/§0.6: 원형 내 `youtubeCnt` 내림차순 상위 k 선정, `youtubeCnt`=유튜브 조회수·선정 기준, `playCnt`
  동결값 보완(Q5). AcousticBrainz 출처는 검증 전 확정 문구로 넣지 않는다.
- api-spec §3.4 축 개수 변화 설명 → 현재 축 쌍 대응(level n→PC(2n-1)·PC(2n))으로 수정(C1/C4).
