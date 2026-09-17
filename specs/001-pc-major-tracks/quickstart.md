# Quickstart / Validation: PC 레벨·중심좌표 기반 대표곡 조회

**Spec**: [spec.md](spec.md) | **Contract**: [contracts/music-major.md](contracts/music-major.md) | **Date**: 2026-09-08

구현 착수 전 조건부 검증 가이드다. **확정된 수용 기준(A1~A14의 확정 부분)만** 실행 대상이며, 미정 정책(B1~B6)에
의존하는 기대값은 확정 후 보완한다. 검증 결과는 통과·실패·미실행을 구분한다(FR-011).

## 사전 조건

- JDK 17, Gradle wrapper(9.7.1 선언). 실제 다운로드·JDK 호환 확인은 전제.
- 실행: `cd backend && ./gradlew test` (PowerShell: `cd backend; .\gradlew.bat test`). wrapper는 `backend/`에 있다.
- MVC 슬라이스는 master 시큐리티 유입 때문에 `SecurityConfig`·`JwtAuthenticationFilter`·OAuth2 자동설정을 제외하고 `TestMapper`·`UserMapper`를 mock 해야 컨텍스트가 뜬다(기존 `MusicControllerTests` 참조, S15P21A405-115).
- 현재 `MusicService.getMajor`는 `UnsupportedOperationException` 미구현. 통합 검증은 B6(BE4 조회 인터페이스) 후.

## 지금 실행 가능한 검증 (DB·아티팩트 불필요)

기존 [MusicControllerTests](../../backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java)를 확장한 MVC 슬라이스
(서비스는 `@MockitoBean`)와 순수 단위테스트로 커버:

| 시나리오 | 검증 | 방식 |
| --- | --- | --- |
| A1 | 200, `success:true`, `data.content` 배열, `error` 없음 | MVC 슬라이스(기존 통과) |
| A2 | 항목이 §0.6 필드 포함, `location.pc1~pc16` = 곡 기준선 좌표 | MVC 슬라이스 |
| A3 | 지도 응답에서 `youtubeUrl`을 제외하고 `playable:false` 곡도 유지 | MVC 슬라이스 |
| A5 | `level=1` PC 생략 → `VALIDATION_ERROR` 아님(200) | MVC 슬라이스(기존 통과) |
| A7 | `level=abc` / PC에 `abc` → 400 `VALIDATION_ERROR` + 공통 실패 구조 | MVC 슬라이스(level=abc는 400까지 통과, 코드는 아직 master `INVALID_INPUT` — M4 미해소) |
| A8 | 내부 실패 → 500 `INTERNAL_ERROR` + 공통 실패 구조 | MVC 슬라이스(서비스 예외 mock) |
| A9/A10 | level=1→pc1·pc2, level=2→pc3·pc4로 축 해석 | `MajorQueryContractTests` (`MajorQuery.axisX/axisY`). ~~`MajorQueryResolver`~~ 는 2026-09-12 삭제 |
| A14(부분) | 순수 후보 리스트에 `youtubeCnt DESC` top-k, `playCnt` 역순 무영향 | 선정 로직 순수 단위테스트(예: 300·100·200, k=2 → 300·200) |

순수 단위테스트 최소 자기검사 예: 후보 조회수 `[300,100,200]`, k=2 → 선정 `[300,200]` (spec A14 예시). 프레임워크
불필요, 하나의 assert 검사면 로직 붕괴를 잡는다.

## B6 이후 통합 검증 (실데이터)

- A4 / SC-002: 같은 좌표계 버전에서 동일 곡의 반환 PC1~PC16 차이 0, 조회로 좌표·모델 변경 0건.
- A11~A13: 같은 레벨 두 중심 → 각 요청 중심 기준 원형, 동일 레벨 반경 적용, 고정 그리드로 대체 안 함.
- A12: 원 내부 포함/외부 제외(원주 포함 여부는 B2 확정 후).

## 미정으로 보류 (기대값 확정 전 실행하지 않음)

| 보류 | 의존 |
| --- | --- |
| 정확한 후보 곡 ID·포함/제외, 반경·축 스케일·원주 규칙 | B2 |
| k 확정값, 동률·null·중복·부족·빈 결과·페이지 계약 | B4, C2 |
| level 상한·생략·추가/누락 PC·좌표 유효성 오류 기대 | B1 |
| 인증 통합, 토큰 없음 코드, `genres`/null/정수 표현 | B5 |

## 성능 / 관측 (FR-011, SC-003·SC-004)

- 지표: 기존 Actuator + Micrometer Prometheus(`management.endpoints ... prometheus`)로 요청 수·지연·오류·반환 수 기록.
- 로그·지표에 비밀정보·불필요 PII 노출 0건(SC-004).
- SC-003의 "지도 조회·렌더링 2초"는 지도 전체 목표. **이 API 단독 시간 예산·백분위·측정 환경은 D6에서 정한다** —
  임의 수치·백분위를 만들지 않는다.
