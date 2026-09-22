# Validation: Music Taste Analysis

검증일: 2026-09-22
브랜치: `backend/feat/S15P21A405-512-music-taste-analysis`
검증 커밋: `47fce630` (기준 `origin/backend/dev` 커밋 `64b7bb1f` 위)

최신 통합 검증(2026-09-22): Claude 후속 작업 `9a3b2e1a`와 DDL 정리 `910e4ac2`를 현재 브랜치에서 병합했다. `backend/gradlew.bat test build` 성공(1분 15초). 아래 `47fce630` 집계는 이전 실행 기록이다. 목록 응답은 `content`, 좋아요 DB 시각 컬럼은 `created_at`이며 최신 DDL은 CONCURRENTLY와 lease 전용 index를 사용하지 않는다. 후속 작업은 이 통합본을 기준으로 진행한다.

구조 단순화 후에는 기준 데이터·축 라벨·분석 정책·프롬프트 버전을 `analysisVersion` 하나로 관리한다. API와 DB도 이 값 하나만 노출·저장하며, 해당 요소 중 결과에 영향을 주는 변경이 있으면 `TASTE_ANALYSIS_VERSION`을 올리고 같은 버전의 기준 산출물을 배포한다. `backend/gradlew.bat test build` 성공(1분 16초).

`origin/backend/dev`는 그 뒤 `1eda4e60`까지 전진했지만 변경 파일이 전부 `realtime/ride` 계열이라
이 브랜치(`taste`, `music/like`)와 **겹치는 파일이 0개**다. 그래서 리베이스하지 않고 `64b7bb1f` 기준을 유지했다.

### 이 문서 기준 커밋 이후 변경

| 커밋 | 내용 |
|---|---|
| `22f1c88e` | 검증 수준 분리, 기준 커밋·테스트 집계 갱신, T049 주석, plan p95 통일 |
| `3c0ca853` | 좋아요 목록 `albumMbid` 협의 항목 철회 (FE 소비처 확인 결과 불필요) |
| `c599114b` | **`LikedMusicResponse` 응답 필드 `items` → `content`** (저장소 목록 응답 규약에 맞춤). `BACKEND-NOTES`의 `TASTE_INSUFFICIENT_SAMPLE` 상태코드를 422로 정정 |
| `47fce630` | `POST /api/taste-analysis`가 항상 200인 근거 기록 |

## 검증 수준 구분

자동 검증 표는 **JVM 테스트(mock·synthetic 입력)** 결과다. 별도로 PostgreSQL 카탈로그 조회와
CHECK 표현식의 읽기 전용 SELECT를 수행했다. 실제 DDL·Mapper 실행, 실제 GMS,
배포 환경을 거친 E2E 검증은 **아직 없다.** 아래 두 표를 섞어 읽지 않는다.

## 1. 자동 검증 (mock/synthetic, 통과)

| 시나리오 | 결과 | 근거 |
|---|---|---|
| 좋아요 9곡 | 통과 | 분포는 반환하고 `additionalLikesNeeded=1`, 생성 요청은 `TASTE_INSUFFICIENT_SAMPLE`로 거부 |
| 좋아요 10곡 | 통과 | `INITIAL` 리포트 자격 부여 |
| 좋아요 29곡 | 통과 | `INITIAL` 유지 |
| 좋아요 30곡 | 통과 | `STANDARD`로 전환 |
| 같은 snapshot 재요청 | 통과 | 저장 결과를 `REUSED`로 반환하고 GMS를 호출하지 않음 |
| 성공 후 좋아요 변경 당일 재요청 | 통과 | 429와 다음 KST 자정 `nextAvailableAt` 반환 |
| 활성 생성 lease | 통과 | GET은 `IN_PROGRESS`, 중복 POST는 409와 lease 만료 시각 반환 |
| 생성 중 좋아요 변경 | 통과 | 생성에 사용한 분포를 보존하고 완료 응답을 즉시 `STALE`로 표시 |
| lease 만료 후 재claim | 통과 | terminal update가 `requestedAt`까지 비교하여 이전 attempt의 덮어쓰기를 차단 |
| GMS 실패 | 통과 | `FALLBACK`, 일일 한도 미차감, 재시도 가능 |
| GMS 요청 최소화 | 통과 | `/v1/responses`, Bearer 인증, `store=false`, strict schema 사용; 이메일·곡 ID·제목 미전송 |
| GMS grounding | 통과 | unknown finding, 승인 axisPhrase 누락, 근거 없는 장르 추론을 거부하고 fallback 처리 |
| 기준 산출물 오류 격리 | 통과 | 로더 검증 실패가 애플리케이션 기동을 막지 않고 취향 API에서 503 처리 |
| 개별 곡 좋아요 | 통과 | target-state 멱등 처리, 취소, 없는 곡 오류, 최근 좋아요순 가상 플레이리스트 검증. 목록 응답 래퍼는 `content` (저장소 목록 응답 규약) |

실행 결과:

```text
backend/gradlew.bat cleanTest test build
BUILD SUCCESSFUL in 1m 8s
```

`47fce630`에서 실행했다. `backend/build/test-results/test/*.xml` 집계: 총 832개 중 72개는 기존 조건부
테스트로 skipped, 실행된 760개는 failure 0, error 0. `items` → `content` 리네임(`c599114b`) 전후로
개수 변동은 없고, 응답 필드명을 검증하는 `MusicLikeControllerTests`/`MusicLikeServiceTests`도 함께 통과했다.

## 2. 아직 검증하지 않은 것 (완료로 표시하지 않는다)

| 항목 | 현재 상태 | 필요한 것 |
|---|---|---|
| 실제 PostgreSQL 동작 | **미검증.** T049는 `taste_analysis_001_table.sql`과 `TasteAnalysisMapper.xml`의 **문자열 계약 테스트**일 뿐, partial unique index·동시 claim·lease 회수를 실제 DB에서 실행하지 않았다. 저장소에 Testcontainers 의존성이 없다 | Data/DB 파트가 staging PostgreSQL에서 재현 |
| 실제 GMS 호출 | **미검증.** `GmsTasteClientTests`는 MockRestServiceServer 기반이다. 실제 `GMS_KEY`로 호출한 적이 없다 | Infra의 secret 주입 + staging 1회 호출 |
| 운영/staging DB 반영 | **미반영.** 2026-09-22 09:09 KST 운영 `ody` DB 읽기 전용 조회에서 `music_like`·`taste_analysis` 둘 다 없음(전체 스키마 기준). `music`, `playlist_like`는 존재 | Data/DB 파트의 DDL 검토·적용 |
| `taste-reference-v1.json` | **없음.** 기본 설정에서 취향 분석 API는 `TASTE_REFERENCE_UNAVAILABLE`(503)을 반환한다. 테스트는 fixture로만 통과한다 | Data 파트의 승인된 기준 산출물 |
| SC-003 성능 (분포/기존 리포트 p95 3초, 신규 생성 p95 30초) | **미측정.** 동시 사용자 10명·100회 측정 없음 (T065) | Infra + 실제 환경 |
| SC-001 반복 조회 20회 동일성 | **부분.** 통계 계산의 결정성은 단위 테스트로 확인했으나 명세가 요구하는 20회 반복 실행 근거는 없다 | 실행 기록 추가 또는 SC 문구 조정 합의 |
| SC-002 사전 정의 사례 20개 | **부분.** 고저 집중·경계·누락 등 일부만 테스트에 있고 20개 사례가 문서로 고정돼 있지 않다 | 사례 목록 확정 후 테스트 보강 |
| SC-005 사용자 이해도 | **해당 태스크 없음.** 5명 사용성 검토를 수행할 태스크가 tasks.md에 없다 | Frontend 완료 후 기획과 일정 합의 |
| 근거 없는 LLM 추론 차단 | **부분.** 현재 검증은 승인된 finding id·axisPhrase 화이트리스트와 금지어 기반이다. "근거 없는 추론을 전부 차단"이라는 명세 문구보다 좁다 | 명세 문구를 구현 범위에 맞추거나 검증 방식 확장 합의 |
| metrics 운영 확인 절차 | **미정.** counter/timer는 구현돼 있으나 어떤 Prometheus query로 무엇을 보는지 문서가 없다 | Infra 파트 (T067) |
| T001–T003 승인 게이트 | **미완료 상태에서 구현이 선행됐다.** 기능 명세·API·축 라벨 승인을 받지 않은 채 코드가 먼저 나왔다 | 기획/Frontend/Data 승인 후 문서 동기화 |

## 3. 배포 전 필수 항목

2026-09-22 구조 리뷰: 운영 `ody` DB에서 두 테이블이 아직 없음을 재확인했다. `taste_analysis`의 미사용 `created_at`/`updated_at`과 전체 lease 검색용 index를 제거하고 Mapper를 동기화했다. 상태별 무결성 CHECK는 유지하면서 성공 필수 필드를 ROW 검사로 묶고 NULL lease를 명시적으로 거부한다. `music_like`는 3개 컬럼을 유지하며 신규 테이블의 index를 일반 CREATE INDEX로 변경했다. 전달했던 최초 SQL 대신 현재 수정본을 사용해야 하며, 두 파일 모두 이제 CONCURRENTLY를 사용하지 않는다. 운영 DB 변경은 수행하지 않았다.

구조 리뷰 검증: `backend/gradlew.bat test build` 성공(57초). PostgreSQL 읽기 전용 SELECT로 ROW 필수값 검사 및 NULL lease 거부를 확인했다. 실제 DDL 적용·Mapper SQL 실행·동시성 통합 검증을 대체하지 않는다.

### Data/DB 파트

- `music_like_001_table.sql`, `taste_analysis_001_table.sql`을 검토해 staging·운영 PostgreSQL에 적용한다.
  최신 두 DDL은 일반 CREATE INDEX를 사용하므로 하나의 트랜잭션으로 실행할 수 있다.
- 실제 PostgreSQL에서 claim, partial unique index, lease 회수와 FK/index 동작을 검증한다.
- 승인된 `taste-reference-v1.json`과 checksum/lineage를 생성해 Backend에 전달한다.
  기존 PC 좌표계를 그대로 쓴다 — **PCA 재수행은 이 작업의 후속으로 추가하지 않는다.**

### Frontend 파트

- 곡 좋아요 UI와 최근 좋아요순 가상 플레이리스트를 기존 재생 큐에 연결한다.
- PC 분포 차트, 분석 생성 버튼, 1일 1회 제한, 생성 상태, 마지막 갱신 시각, STALE과 오류 상태를 표시한다.
- 계약은 `docs/rules/BACKEND-NOTES.md` A-48~A-51 참고.

### Infra 파트

- 운영 서버 secret 환경변수로 **`GMS_KEY`** 를 주입하고(`GMS_API_KEY` 아님) `gms.ssafy.io:443` outbound HTTPS를 허용한다.
- 실제 GMS staging 호출과 key·Authorization header 비노출을 검증한다.
- Actuator/Prometheus 지표 노출과 SC-003 성능을 측정한다.
