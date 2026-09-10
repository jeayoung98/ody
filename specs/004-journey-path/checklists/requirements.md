# Specification Quality Checklist: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10 · **Revised**: 2026-09-10 (rev.2 — BE4 데이터 엔진 MR 반영 / rev.3 — clarify 4문항 반영)
**Feature**: [spec.md](../spec.md) · Jira S15P21A405-61 · 기능 ID JOURNEY-01

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### rev.2에서 바뀐 것

rev.1은 정본 §3.3 문구("출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택")를 유일한 방식으로 전제했다.
BE4가 원격 MR에서 그 방식(`linear`)을 측정해 기본에서 내렸다(**D10**). rev.2는 실제 코드·결정·측정값을 반영한다.

| rev.1 | rev.2 |
| --- | --- |
| 등분 보간 → 최근접 (Q1 미정) | `axis` 축 통로 + Viterbi 기본 (D10). 정거장 수는 D3 `clamp(10, 20)` |
| 아티스트 규칙 미정 (Q2) | `artist_cap` = 3 (파일에서 읽음), 아티스트 전체 유한 벌점 |
| detour 미정 (Q3) | API 파라미터 아님. 엔진 내부 상수 |
| 균등성 = 변동계수 (자체 정의) | BE4 벤치마크 지표 — 인접 역 거리 median p50/p95, 단조 위반, 규칙 위반 |
| 30곡 초과 축소 알고리즘 | 축소 없음. 엔진 상한 20 → 계약 가드로만 확인 |
| BE4 MyBatis 조회 port 위임 | **D4**: Python FastAPI 엔진, BE2는 게이트웨이 |
| 단조 증가 요구 없음 | **FR-020 신규** — linear가 40쌍 중 21쌍 위반한 것이 D10 근거 |
| 식별자 문제 인식 없음 | **FR-022 신규** — int `id` ↔ `mbid` 매핑 원천 없음 (B-ID) |
| 모드 언급 없음 | **FR-023 신규** — `axis` 고정, 클라이언트 비노출 |

FR 19개 → 23개. `[NEEDS CLARIFICATION]` 3건은 BE4 증거로 해소했고, 대신 **계약 공백 3건**이 드러났다.

### 계약 공백 — clarify(2026-09-10)로 전부 해소, 차단 없음

| ID | 결정 | 남은 일 |
| --- | --- | --- |
| **B-ID** | BE 소유 곡 테이블이 int `id` PK + `mbid` UNIQUE. 게이트웨이가 양방향 해석. 정본·프론트 불변 | BE4에 `mbid` 컬럼 포함 요청 |
| **B-Gate** | **종단 3초가 유일 게이트**. 엔진은 하위 예산(실측 p95 1.541초), 게이트웨이에 남는 예산 약 1.46초 | BE4에 스펙 11 AC1 5초 하향 요청 |
| **B-Engine-Err** | 엔진 부재·타임아웃·조립 불가 = **500 `INTERNAL_SERVER_ERROR`**. 422와 섞지 않음. 새 코드·503 추가 없음 | 없음 (BE2 범위) |
| **B-Far** | 엔진 메타(`far`·`endpoint_dist` 등) **응답에 싣지 않음**. 정본 §3.3 유지, 관측 지표로만 | FE1에 `musicCnt` 12~22 변동 알림 |

plan을 막는 항목은 없다. `B-Engine`(엔진 HTTP 엔드포인트 미구현)만 **통합 검증 시점**의 대기 항목이다.

### 상대 파트에 알려야 할 점 (CLAUDE.md §3)

- **[기획/문서 — 정본 §3.3 갱신 필요]** ① "중간 지점: 출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택"은
  D10 이후 기본 동작이 아니다(`linear` 모드의 서술). ② "초과 경로는 서버가 30곡 이하로 줄인 뒤 곡 간 도약을
  재평가"는 엔진 정거장 상한이 20이라 발동하지 않는다.
- **[BE4 — 곡 테이블 `mbid` 컬럼]** 게이트웨이가 `id ↔ mbid`를 해석하기로 정했다(clarify). BE 소유 곡 테이블에
  int `id` PK와 함께 **`mbid` UNIQUE 컬럼이 있어야 한다.** data 소유 `track`은 mbid PK이므로 적재 시 대응이 필요하다.
- **[BE4 — 성능 게이트 하향]** 종단 3초를 유일 게이트로 확정했다(clarify). data 스펙 11 AC1의 `axis` p95 ≤ 5초는
  상위 게이트를 넘으므로 3초 이하로 하향 조정을 요청한다. 실측 1.541초라 지금 바꿔도 통과한다.
- **[BE4 — 스펙 11 문구]** 규칙절이 "아티스트당 ≤ 2"인데 `postprocess_rules.json`의 `artist_cap`은 3이고
  구현(`journey.py::_rule_violation`)은 파일 값을 읽는다. 스펙 문구가 최신이 아니다.
- **[BE4 — B-Engine]** `retrieval/api.py`가 docstring만이라 게이트웨이가 호출할 대상이 없다.
  `GET /journeys` 엔드포인트 형태(경로·파라미터·오류 코드)가 확정되면 게이트웨이 경계를 맞춘다.
- **[FE1 — 여정 곡 수 변동]** 40쌍 중 30쌍이 far 여정이라 `musicCnt`가 **12~22로 변동**한다. 여정 패널이 고정
  10곡(또는 12곡)을 가정하고 있으면 어긋난다. `far` 플래그는 응답에 싣지 않기로 했으니(clarify) 화면은
  `musicCnt`·`path.length`만 보고 그려야 한다. "먼 여정입니다" 안내가 필요하면 -62에서 계약 추가를 논의한다.
- **[BE4 — 머지 순서]** MR !17은 `S15P21A405-39` 위에 쌓여 있어 39 선행 머지가 필요하다(BE4 코멘트).
  두 브랜치 모두 아직 `data/dev` 미반영이므로 게이트웨이 통합 검증은 그 이후다.

### 검증 시 확인한 항목 (근거)

- **구현 세부 미포함**: 엔드포인트·에러 코드·필드명은 정본 `docs/api-spec.md`의 **계약**이고, 알고리즘 파라미터
  (반경·λ·층 상한)는 "엔진 내부이며 BE2가 정하지 않는다"로 경계만 적었다. 게이트웨이 DTO·HTTP 클라이언트·
  조회 방식은 "plan 단계로 미루는 사항"으로 분리.
- **측정 가능성**: SC-002(3초), SC-003(단조 위반 0), SC-004(규칙 위반 0), SC-005(median 비교),
  SC-006·007·008(차이 0건) 모두 수치 판정 가능하며 BE4 벤치마크와 같은 지표를 쓴다.
- **근거 추적**: 모든 FR이 정본 조항·D 번호·실제 파일(`journey.py`, `postprocess_rules.json`,
  `bench_journey_v2.1-pca16.json`) 중 하나를 인용한다. 헌법 IX에 따라 미확정 항목은 확정된 것처럼 쓰지 않았다.
