# Implementation Plan: 직접 그린 별자리 기반 플레이리스트 생성

**Branch**: `backend/feat/S15P21A405-598-drawn-constellation-playlist` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-drawn-constellation-playlist/spec.md`

## Summary

사용자가 그린 점 3~20개를 받아 595 의 템플릿 생성기와 **같은 경로**(상자 중심 배치 → 점마다 미사용 최근접 곡)로 곡을 고르고, 그림과 결과의 **Procrustes 모양 일치도**(이동·회전·균일 배율 불변, 반사 제외)를 0~100 점수와 HIGH/MEDIUM/LOW 로 돌려준다. 플레이리스트는 만들지 않는다 — 저장은 기존 `/playlist/create`.

운영 실측(research R1)에서 곡이 pc1/pc2 평면을 빽빽이 덮어 오차가 반폭의 0.1% 수준이었으므로 **회전 탐색은 하지 않는다.** 불변성은 탐색이 아니라 점수 식으로 보장한다. 새 테이블·새 의존성 없음.

## Technical Context

**Language/Version**: Java 17 (`sourceCompatibility = '17'`), Spring Boot 4.1

**Primary Dependencies**: Spring Web·Validation, MyBatis — 모두 기존. 새 의존성 없음

**Storage**: PostgreSQL `music.location vector(16)`, `music_l1_gist` 표현식 GiST — 읽기만. 스키마 변경 없음

**Testing**: JUnit 5 + Mockito (`CatPlaylistGeneratorTests` 패턴 — 격자 가상 곡, 매퍼 목)

**Target Platform**: 운영 Docker `backend-blue/green` (Blue-Green)

**Project Type**: web-service (백엔드). 캔버스 화면은 FE 파트 요청

**Performance Goals**: 20점 요청 p95 < 3 s, 모두 < 10 s (SC-001). 실측 23점 0.16 s(캐시 후)

**Constraints**: 첫 호출 콜드 8.9 s(상자 백분위) 제거 필요 (R4). 같은 입력 → 같은 출력 (FR-012)

**Scale/Scope**: 후보 465만 곡. 요청당 KNN 최대 80회(20점 × 배율 4단계)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I 명세 우선 | ⚠️ 조건부 | spec Clarified. **FEATURES.md 항목 없음** — 변경 제안 #29 에 자유 그리기 확장 제안을 올린다(tasks 에 포함). 기획 확인 전까지 "제안" 상태 |
| II 계약 우선 | ✅ | [contracts/draw-match.md](./contracts/draw-match.md). 신규 에러 코드 1개 → BACKEND-NOTES 갱신 + FE 통보 |
| III 완료 전 검증 | ✅ | 불변성·단계·중복·입력 오류 단위 테스트, `./gradlew test build`, 배포 후 quickstart |
| IV 데이터 재현성 | ✅ 해당 적음 | 새 데이터 산출물 없음 |
| V 좌표 안정성 | ✅ | 서빙 baseline `music.location` 그대로, 재학습 없음, pc1/pc2 고정축(확정) |
| VI 탐색 일관성 | ✅ 해당 없음 | 지도 탐색 규칙과 무관 |
| VIII 관측 가능성 | ✅ | `[Artwork] 그림 매칭 points score quality ms` INFO, 예열 로그 |
| IX 암묵적 가정 금지 | ✅ | 단계 경계·입력 규약·타임아웃 미도입 모두 research 에 근거와 `ponytail:` 조정 경로 |
| X 아키텍처 경계 | ✅ | `artwork` 패키지 안. `music.service.ConstellationService` 의존은 595 에 이미 있음 |

재평가(Phase 1 후): 변동 없음. I 의 조건(FEATURES 제안)만 남는다.

## 설계

### 변경 파일 (최소)

| 파일 | 변경 |
| --- | --- |
| `artwork/service/CatPlaylistGenerator.java` | `generate` 의 배치 탐색을 `match(List<double[]>)` 로 추출해 템플릿·그림이 공유. `draw(points)` 추가(정규화 → match → layout → 점수). `ApplicationReadyEvent` 상자 예열(데몬 스레드) |
| `artwork/service/ShapeScore.java` (신규, 순수 계산) | Procrustes 점수·단계. Spring 의존 없음 — `PlanarProjection` 과 같은 성격 |
| `artwork/dto/DrawRequest.java` · `DrawResponse.java` (신규) | 계약 그대로. `@Size(min=3,max=20)`, 좌표 `@DecimalMin(0) @DecimalMax(1)` |
| `artwork/controller/ArtworkController.java` | `POST /draw` 한 개 |
| `artwork/.../ArtworkErrorCode.java` | `ARTWORK_DRAWING_DEGENERATE(400)` |
| 테스트 | `ShapeScoreTests`(불변성·반사·단계), `CatPlaylistGeneratorTests` 에 draw 케이스 |
| 문서 | BACKEND-NOTES §6-8, FEATURES 변경 제안 #29 보강 |

템플릿 `generate` 의 외부 동작은 바꾸지 않는다 — 추출만 한다.

### 흐름

```text
POST /api/artwork/draw {points[0~1, y 아래]}
  → 검증: 3~20, 0~1 (Bean Validation → INVALID_INPUT)
  → bbox 긴 변 < 0.02 → ARTWORK_DRAWING_DEGENERATE
  → 정규화: y 반전, 중심 이동, 최대 절댓값 1   (템플릿 좌표계와 동일)
  → match(): 상자 중심 · SCALES 4단계 · 점마다 KNN 8 중 미사용 첫 곡 · 평균 오차 최소   (595 그대로)
  → ConstellationService.layout(musicIds)  → 응답 points   (FR-011)
  → ShapeScore(정규화 그림, layout 좌표) → score, quality
  → 200 (플리 생성 없음)
```

### 점수 (research R2·R3)

`u`, `v` 를 중심 이동·노름 1 로 맞추고 `a = Σ conj(u_i)·v_i`, `d = √(2 − 2|a|)`, `score = round(100·max(0, 1 − d))`. 단계 90/70. `layout` 좌표는 pc1/pc2 를 이동·동일 배율한 값이라 모양 비교에 그대로 쓸 수 있다.

## Project Structure

### Documentation (this feature)

```text
specs/010-drawn-constellation-playlist/
├── spec.md
├── plan.md              # 이 파일
├── research.md          # R1~R6
├── data-model.md        # 스키마 변경 없음
├── quickstart.md
├── contracts/draw-match.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
backend/src/main/java/com/ssafy/backend/artwork/
├── controller/ArtworkController.java        # + POST /draw
├── dto/DrawRequest.java, DrawResponse.java  # 신규
├── service/CatPlaylistGenerator.java        # match 추출 + draw + 예열
├── service/ShapeScore.java                  # 신규, 순수 계산
└── (ArtworkErrorCode)                       # + ARTWORK_DRAWING_DEGENERATE
backend/src/test/java/com/ssafy/backend/artwork/
├── ShapeScoreTests.java                     # 신규
└── CatPlaylistGeneratorTests.java           # + draw 케이스
```

**Structure Decision**: 기존 `artwork` 모듈 안에서 끝낸다. 생성기 클래스 이름이 "Cat" 이지만 이번에 바꾸지 않는다 — 이름 변경은 동작 없는 diff 이고 595 리뷰 이력과 어긋난다.

## 상대 파트에 알릴 것 (구현 후)

- **[FE]** 캔버스 그리기 화면 전체(US1~4 UI), `POST /api/artwork/draw` 계약, 신규 에러 코드 `ARTWORK_DRAWING_DEGENERATE`(`types/api.ts`), LOW 는 경고+저장 허용, 요청 타임아웃 10 s.
- **[기획]** FEATURES #29 에 자유 그리기 확장 제안.

## Complexity Tracking

위반 없음.
