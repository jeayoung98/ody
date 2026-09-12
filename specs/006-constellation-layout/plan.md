# Implementation Plan: 별자리 배치 (musicIds → 2D 고정 좌표)

**Branch**: `backend/feat/S15P21A405-265-constellation-layout-api` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Jira**: S15P21A405-265

**Input**: Feature specification from `specs/006-constellation-layout/spec.md`

## Summary

곡 id 목록(2~30개)을 받아 각 곡의 2D 배치 좌표를 내려주는 조회 전용 API 를 낸다.
좌표 원천은 서빙 baseline `v2.1-pca16` 의 `music.location`(16차원)이고, **그 요청 집합만의 분산이 가장 큰
두 방향**으로 투영해 `-1 ~ 1` 로 정규화한다. 같은 곡 집합이면 순서·레이어·호출자와 무관하게 항상 같은 좌표가 나와야 한다.

기술 접근: 16×16 공분산 행렬을 만들어 **Jacobi 고유분해**로 상위 두 고유벡터를 구한다(외부 수치 라이브러리 없음, 16차원 고정이라 비용이 상수). 결정성은 세 가지로 확보한다 — ① 곡을 `musicId` 오름차순으로 정렬한 뒤 누적해 부동소수 합의 순서를 고정, ② 고유벡터 부호를 "절댓값 최대 성분을 양수로" 규약으로 고정, ③ 반복 횟수에 의존하는 거듭제곱 반복 대신 수렴 판정이 명확한 Jacobi 사용.

데이터 접근은 기존 `MusicDetailReader` port 에 좌표 일괄 조회 1개를 더한다. 새 port·새 어댑터·새 row DTO 를 만들지 않는다 — 같은 테이블·같은 컬럼이고 어댑터가 이미 있다.

## Technical Context

**Language/Version**: Java 21, Spring Boot 4.1.1

**Primary Dependencies**: spring-boot-starter-webmvc, spring-boot-starter-validation, mybatis-spring-boot-starter 4.1.0. **수치 라이브러리 추가 없음** (commons-math 등 미사용 — [research.md R1](research.md) 참조)

**Storage**: PostgreSQL + pgvector. `music.location vector(16)` 을 `MusicDetailMapper.xml` 의 `locationColumns` 로 16축으로 펼쳐 읽는다. 거리 인덱스(HNSW)는 쓰지 않는다 — 이 기능은 KNN 이 아니라 지정된 id 집합의 좌표 조회다

**Testing**: JUnit 5 (`spring-boot-starter-webmvc-test`), 기존 명명 규칙 `*Tests.java`. 투영 로직은 Spring 없이 단위 테스트, 서비스는 fake reader, 컨트롤러는 MockMvc

**Target Platform**: Linux 서버 (기존 백엔드 컨테이너)

**Project Type**: Web service (backend), 기존 `backend/` 모듈에 추가

**Performance Goals**: 30곡 요청 1초 (SC-002 — 요구사항 §6 "유사곡 1초" 준용, **실측 후 조정 가능한 잠정 기준**). DB 왕복 1회, 투영 연산은 16×16 고정이라 μs 단위라 여유롭게 들어올 것으로 본다

**Constraints**: 조회 전용(부수효과 없음). 요청 본문의 좌표를 쓰지 않는다. 같은 집합 → 비트 단위 동일 좌표

**Scale/Scope**: 요청당 곡 2~30개. 엔드포인트 1개, 신규 클래스 5개 내외

## Constitution Check

*GATE: Phase 0 전 통과해야 하고, Phase 1 설계 후 재확인한다.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I. 명세 우선 | ✅ | `spec.md` 작성 완료. 승인권자·승인 기록은 헌법 TODO(APPROVAL_PROCESS) 로 미정 상태 그대로다 |
| II. 계약 우선 | ✅ | `contracts/constellation-layout.md` 를 구현 전에 작성. FE 타입(`types/constellation.ts`)이 이미 같은 모양이라 신규 계약이 아니라 **기존 프론트 계약의 서버 구현**이다 |
| III. 완료 전 검증 | ✅ | 결정성·정규화·오류 분기·왕복 수 각각에 대응하는 테스트를 tasks 로 낸다 |
| IV. 데이터 재현성 | ✅ | 새 데이터 산출물 없음. 읽기만 한다 |
| V. 좌표 안정성 | ✅ (주의 1건) | 서빙 좌표를 **읽기만** 하고 재학습·재계산하지 않는다. 응답의 2D 는 서빙 좌표계가 아니라 **표시용 투영**이며, 요청 집합에 따라 축이 달라지는 것이 정상이다. 이 구분을 계약 문서에 명시한다 |
| VI. 탐색 일관성 | ✅ | 요청한 곡 집합을 조용히 줄이거나(없는 곡 스킵) 합치지(중복 병합) 않는다 — 400/404 로 돌린다 |
| VII. 실험 격리 | N/A | 실험 데이터·모델 없음 |
| VIII. 관측 가능성 | ⚠️ 계획에 포함 | 아래 "관측" 절에 지표를 명시. 요청 본문에 곡 id 외 개인정보가 없어 로그 노출 위험 없음 |
| IX. 암묵적 가정 금지 | ⚠️ 미결정 1건 | 경로 표기 `/api/constellations/**` 복수형 — FE 상수·A-9 문서를 따르되 접두사 정렬(S15P21A405-213·214)에서 재확인. `playlist/` 수정 권한과 곡 상한 30, 성능 목표는 2026-09-13 clarify 로 해소 |
| X. 아키텍처 경계 | ✅ (합의됨) | US2 의 N+1 제거는 `backend/.../playlist/`(BE1 Core 소유)를 고쳐야 한다. **2026-09-13 합의로 이번 이슈 범위에 포함한다.** 커밋을 분리해 리뷰·되돌리기를 독립시킨다 |

### 관측 (원칙 VIII)

| 지표 | 확인 방법 |
| --- | --- |
| 배치 요청 수·지연(p95)·상태코드 분포 | Actuator `http.server.requests` (`uri=/api/constellations/layout`), Prometheus |
| 곡 좌표 조회 왕복 수 | 테스트에서 fake/spy reader 호출 횟수로 고정. 운영에서는 요청당 쿼리 1회 전제 |
| 404 비율 | 위 지표의 `status=404` — 프론트가 서버에 없는 곡 id 를 보내고 있다는 신호 |

로그에 곡 id 외 사용자 식별자를 남기지 않는다.

### 경계 (원칙 X) — 이번 브랜치의 커밋 분리

- **Phase A**: 배치 API 신설. `music/` 안에서만 끝난다.
- **Phase B**: `PlaylistService.loadMusicDetails` 의 N+1 제거. 2026-09-13 합의로 이번 브랜치에 포함한다.
  **커밋을 분리한다** — `playlist/` 는 BE1 소유라 리뷰어가 그 변경만 따로 볼 수 있어야 하고, 문제가 생기면 배치 API 를 건드리지 않고 되돌릴 수 있어야 한다.

## Project Structure

### Documentation (this feature)

```text
specs/006-constellation-layout/
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── constellation-layout.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 산출 (이 명령이 만들지 않는다)
```

### Source Code (repository root)

```text
backend/src/main/java/com/ssafy/backend/music/
├── controller/
│   └── ConstellationController.java          # 신규 — POST /api/constellations/layout
├── service/
│   └── ConstellationService.java             # 신규 — 검증·조회·투영 조립
├── constellation/
│   └── PlanarProjection.java                 # 신규 — 16D→2D 순수 함수 (Spring 무관)
├── dto/
│   ├── ConstellationLayoutRequest.java       # 신규 — { musicIds }
│   ├── ConstellationLayoutResponse.java      # 신규 — { points }
│   └── ConstellationPoint.java               # 신규 — { musicId, x, y }
├── detail/
│   ├── MusicDetailReader.java                # 수정 — findLocationsByIds 추가
│   └── MusicDetailReaderAdapter.java         # 수정 — 위 구현
└── mapper/
    └── MusicDetailMapper.java                # 수정 — findLocationsByIds

backend/src/main/resources/mapper/music/
└── MusicDetailMapper.xml                     # 수정 — id IN 좌표 일괄 select (locationColumns 재사용)

backend/src/test/java/com/ssafy/backend/music/
├── constellation/PlanarProjectionTests.java  # 신규 — 결정성·정규화·퇴화 케이스
├── ConstellationServiceTests.java            # 신규 — 검증 분기, 왕복 1회, 부분결과 금지
└── ConstellationControllerTests.java         # 신규 — 응답 봉투·상태코드

# Phase B (커밋 분리)
backend/src/main/java/com/ssafy/backend/playlist/service/PlaylistService.java
```

**Structure Decision**: 기존 `backend/` 단일 모듈의 `music` 도메인 안에 추가한다. 별자리는 곡 좌표에서 나오는
Discovery 기능이므로 BE2 소유 영역(`music/`)이 맞다. 투영 계산만 `music/constellation/` 하위 패키지로 떼어
Spring·DB 없이 단위 테스트할 수 있게 한다 — `music/journey/` 가 경로 탐색 계산을 떼어 둔 것과 같은 방식이다.

## Constitution Re-Check (Phase 1 설계 후)

| 원칙 | 판정 | 설계에서 달라진 점 |
| --- | --- | --- |
| II. 계약 우선 | ✅ | `contracts/constellation-layout.md` 작성. "보장하지 않는 것"(부분집합 안정성, 지도 좌표와의 무관함)까지 명시해 프론트가 잘못 쓰는 경로를 막았다 |
| III. 완료 전 검증 | ✅ | `quickstart.md` 에 FR ↔ 시나리오 대응표. 결정성은 골든 테스트(Q7)로 고정, 왕복 1회는 호출 횟수 세는 fake(Q10)로 고정 |
| V. 좌표 안정성 | ✅ | 계약 문서에 "응답 2D 는 서빙 좌표계가 아니다" 를 명시. 저장소는 읽기만 한다 |
| VIII. 관측 가능성 | ✅ | 지표 3개와 확인 방법을 위에 명시. 새 계측 코드 없이 기존 Actuator 로 본다 |
| IX. 암묵적 가정 금지 | ⚠️ 유지 | 미결정 2건을 계약 §6(C-1 경로, C-3 자릿수)에 남겼다. 곡 상한 30(C-2)·성능 목표·`playlist/` 권한은 2026-09-13 clarify 에서 결정됐다. 남은 둘은 구현을 막지 않는다 |
| X. 아키텍처 경계 | ✅ | Phase B(`playlist/` N+1)를 이번 이슈 범위로 진행하기로 합의(2026-09-13). 커밋 분리로 리뷰·롤백 독립성을 확보한다 |

**결론**: Phase A·B 모두 진행 가능. 남은 미결정(경로 표기)은 구현을 막지 않는다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 고유분해(Jacobi)를 직접 구현 | 프로젝트에 선형대수 라이브러리가 없다(`build.gradle` 확인). 16×16 대칭 행렬 하나를 풀려고 commons-math 를 새로 넣는 것은 의존성 대비 이득이 없다 | 라이브러리 추가: 배포 이미지·라이선스·버전 관리 비용이 이 50줄보다 크다. 프론트 목처럼 거듭제곱 반복: 반복 횟수에 결과가 의존하고 λ1≈λ2 에서 축이 흔들린다([research.md R1](research.md)) |
| `music/constellation/` 하위 패키지 신설 | 투영 계산을 Spring·DB 없이 테스트하려면 서비스에서 분리해야 한다. `music/journey/` 선례가 있다 | 서비스 안 private 메서드: 결정성·퇴화 케이스 테스트가 서비스 목킹에 묶여 느려지고 읽기 어려워진다 |
