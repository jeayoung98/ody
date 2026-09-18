# Phase 1 Data Model: PC 레벨·중심좌표 기반 대표곡 조회

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-08

wire(외부 계약) DTO는 기존 코드·api-spec §0.6/§3.4를 재사용한다. 내부 조회 모델은 wire와 분리해 설계 제안으로 둔다.
물리 스키마·저장소는 미제공(plan B6)이므로 **논리 모델**과 **확인 항목**만 기록한다.

## 1. Wire DTO — 기존 재사용 (변경 없음이 기본)

| 타입 | 파일 | 필드 | 비고 |
| --- | --- | --- | --- |
| `MajorResponse` | [MajorResponse.java](../../backend/src/main/java/com/ssafy/backend/music/dto/MajorResponse.java) | `content: List<MusicDetail>` | api-spec §3.4는 `content`만 예시. 페이지 정보 적용은 **C2 미정** → 지금 필드 추가하지 않음 |
| `MusicDetail` | [MusicDetail.java](../../backend/src/main/java/com/ssafy/backend/music/dto/MusicDetail.java) | `id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location, playCnt, youtubeCnt` | api-spec §0.6 일치. `genres: List<String>` — 원문은 list\|string\|null 다형(C/P3), 좁히지 않음 |
| `Location` | [Location.java](../../backend/src/main/java/com/ssafy/backend/music/dto/Location.java) | `pc1`~`pc16` (double) | v2.1-pca16 고정 좌표. 응답 시 저장값 그대로(FR-007) |

**null·필수 계약 확인 필요(P3-c)**: `album`·`genres`·`youtubeUrl`은 null 허용(api-spec §0.6). `mbid` 타입·null,
`genres` 다형 표현의 실제 허용 범위는 문서에 없음 → BE4/BE1과 확인 전까지 임의로 좁히거나 넓히지 않는다.

## 2. 내부 조회 모델 — 설계 제안 (아직 파일 없음)

미정 정책에 독립적인 구조만 정의한다. 정책 값(반경·k·경계)은 필드로 **주입**하고 상수로 박지 않는다.

### 2.1 `MajorQuery` (검증·변환 결과, 순수)
- `level: int` — 지원 확인 후의 레벨. 상한·검증 규칙은 **B1 미정**.
- `axisX, axisY: int` — 현재 조회 축 번호. `level` n → `2n-1, 2n` (FR-003 확정). level=1은 pc1·pc2.
- `centerX, centerY: Double` — 해당 축 중심좌표. **level=1 최상위 예외 시 부재 가능**(FR-004); 부재를 (0,0)이나
  전체 영역으로 대체하지 않는다(B2).
- `baselineVersion: String` — `v2.1-pca16` 고정(FR-007).

### 2.2 `MajorSelectionCriteria` (승인 정책, 값 주입)
- `radius: ? ` — 서버 레벨별 반경. **값·단위·축 스케일·원주 포함(<= vs <)은 B2 미정**.
- `topK: int` — 반환 개수. **k 확정값은 B4 미정**(k=1000 잠정, 운영 기본값 아님).
- `priorConstraints: ?` — 장르·이전 PC 선택 누적 조건. **연결 계약은 B3 미정**. 확보 못 하면 전역 후보로 축소하지 않는다.

### 2.3 `MajorCandidate` / 선정 결과
- 후보 = "동일 버전 + 기존 제약 + 원형 내부" 전체 곡 집합.
- 선정 = 후보에 `youtubeCnt DESC` 적용 상위 k, 같은 순서 반환(FR-013). `playCnt`·재생 링크로 순위 변경 금지.
  ⟲ *2026-09-11 D16 으로 서버 요구에서 내려감(클라이언트가 화면 격자에서 한다), 롤백 자산으로만 유지.*
  ⟲ *2026-09-18 D20*: 1레이어 선정 = 데이터 좌표 격자 칸당 `k = min(round(cbrt(n)), 40)` 곡을
  `md5(id::text)` 무작위로, 후보는 재생 가능한 곡으로 한정. 응답 단계 재생 필터 금지(칸이 삭제된다).
- 메타데이터 후조회 시 조회 결과 순서에 의존하지 않고 **선정 ID 순서로 복원**한다.

## 3. 기존 스키마와의 연결 / 데이터 계보 — 확인 항목 (B6)

이 체크아웃에는 DB·엔티티·리포지토리·마이그레이션·datasource가 없다. 아래는 BE4와 확인할 목록이며 **가정하지 않는다**:

| 확인 항목 | 왜 필요한가 |
| --- | --- |
| 곡 저장소 물리 스키마, `id` ↔ wire `id` 매핑 | 조회·메타데이터 복원 |
| PC1~PC16 좌표 저장 형태(컬럼/벡터), v2.1-pca16 manifest·버전 식별자 | 버전 고정·좌표 불변 검증(SC-002) |
| `youtubeCnt` 생성·갱신 계보, snapshot/revision 개념 | 선정 기준 재현성, 캐시 도입 시 키(FR-013, D3) |
| `playCnt` 동결 근거(AcousticBrainz 출처는 사용자 추정, 미확인) | 순위 미사용 확정, 문구 오확정 방지 |
| BE4 조회 인터페이스가 원형+누적 필터+top-k 정확성 계약을 제공하는지 | Reader port 재사용 여부(D2) |

## 3.1 master 통합 반영 (2026-09-09)

master 인프라 확인 결과([plan.md](plan.md) M1~M8):
- **영속 방식**: PostgreSQL + **MyBatis mapper**(`classpath:mapper/**/*.xml`, `map-underscore-to-camel-case`). 조회 결과 row → DTO. 테스트는 H2(PostgreSQL 모드).
- **DTO 스타일(M8)**: master는 Lombok DTO 관례. wire 필드·타입·null 계약은 §1 그대로 유지하되, 재배치 시 record→Lombok 여부는 팀 확인.
- **공통 응답(M3)**: master `ApiResponse.success(data)`/`fail(ErrorCode)`·`ErrorResponse(code,message)` 재사용. feat의 `MajorResponse`/`MusicDetail`/`Location`은 필드 동일하게 유지하되 `backend/`로 재배치.
- **저장소 미확인(B6)**: PC16 좌표 물리 스키마, 대표곡 조회 저장소(postgres vs neo4j), pgvector 유무(현재 없음)는 BE4 확인. §3 확인 항목 유효.

## 4. 데이터 버전 일관성 (규범, FR-007 / SC-002)

- 한 요청 = 기준선 1개(v2.1-pca16) + 정책 버전 1개 + 조회수 snapshot 1개.
- 같은 좌표계 버전에서 동일 곡의 반환 PC1~PC16 차이는 0. 조회로 전처리·차원 축소 모델 재학습·비호환 좌표계 혼합·
  실험 기준선 자동 적용 금지(헌법 V·VII).
