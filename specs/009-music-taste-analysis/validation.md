# Validation: Music Taste Analysis

검증일: 2026-09-22
브랜치: `backend/feat/S15P21A405-512-music-taste-analysis`
검증 커밋: `7da66b39` — 코드 기준 커밋이고, 이 문서 갱신은 그 위에 얹는다 (기준 `origin/backend/dev` 커밋 `64b7bb1f` 위)

> **이 문서의 소유는 한 사람이다.** 2026-09-22 에 병행 작업 두 갈래가 서로 다른 절을 번갈아 고쳐
> §2(미검증)와 §3(배포 전 항목)이 상충한 적이 있다. 검증 결과가 생기면 이 문서를 직접 고치지 말고
> 소유자에게 넘긴다. 구현·DDL 변경은 각자 진행하되 기록은 여기 한 곳으로 모은다.

`origin/backend/dev`는 그 뒤 전진했지만 변경 파일이 전부 `realtime/ride` 계열이라 이 브랜치
(`taste`, `music/like`)와 **겹치는 파일이 0개**다. 그래서 리베이스하지 않고 `64b7bb1f` 기준을 유지했다.

## 커밋 이력

| 커밋 | 내용 |
|---|---|
| `5dfcd963` | 음악 취향 분석 기능 최초 구현 |
| `22f1c88e` | 검증 수준 분리, 기준 커밋·테스트 집계 갱신, T049 주석, plan p95 통일 |
| `3c0ca853` | 좋아요 목록 `albumMbid` 협의 항목 철회 (FE 소비처 확인 결과 불필요) |
| `c599114b` | **`LikedMusicResponse` 응답 필드 `items` → `content`** (저장소 목록 응답 규약에 맞춤). `BACKEND-NOTES`의 `TASTE_INSUFFICIENT_SAMPLE` 상태코드를 422로 정정 |
| `47fce630` | `POST /api/taste-analysis`가 항상 200인 근거 기록 |
| `9a3b2e1a` | 검증 기록을 실측으로 갱신 |
| `910e4ac2` | **DDL 정리** — `taste_analysis`에서 미사용 `created_at`/`updated_at` 제거, lease 전용 index 제거, SUCCESS 필수 필드 검사를 `ROW(...) IS NOT NULL`로 묶고 PENDING에 `lease_expires_at IS NOT NULL` 추가. `music_like`는 `CREATE INDEX CONCURRENTLY` → 일반 `CREATE INDEX`. Mapper·XML 동기화 |
| `134d5bf2` | 위 두 갈래 병합 |
| `a18cd16a` | **`taste_analysis`에서 `total_liked_count`·`excluded_music_count` 제거.** 두 값은 저장하지 않고 조회 시점에 계산한다 |
| `7da66b39` | **버전 관리 통합 — API 계약이 바뀐다.** 응답의 `reference{ bundleVersion, referenceVersion, axisLabelVersion, analysisPolicyVersion }`이 **`analysisVersion` 문자열 하나**로 바뀌었다. DB·기준 산출물 스키마·prompt 버전도 이 값 하나로 관리하고, 결과에 영향을 주는 변경이 있으면 `TASTE_ANALYSIS_VERSION`을 올리고 같은 버전의 기준 산출물을 배포한다. `report.fresh` 판정에 **분석 버전 변경도 포함**된다 |

### 계약 영향 판정

| 커밋 | API 계약 | 근거 |
|---|---|---|
| `910e4ac2`·`a18cd16a` 컬럼 축소 | **영향 없음** | `TasteAnalysisResponse`가 그대로다. `counts.totalLiked`·`counts.excluded`는 저장 컬럼이 아니라 `TasteAnalysisQueryService`가 현재 좋아요에서 매번 계산하고, `REUSED` 응답도 같은 경로를 탄다 |
| `7da66b39` 버전 통합 | **⚠️ 바뀐다** | 응답 최상위 `reference` 객체가 사라지고 `analysisVersion` 문자열이 들어온다. `report.fresh` 의미도 넓어졌다 — 좋아요 변경뿐 아니라 **분석 버전 변경으로도 STALE**이 된다 |

`7da66b39`는 프론트에 전달해야 한다. `BACKEND-NOTES` A-50은 갱신됐고, 아직 FE 화면 구현이 시작되지 않아
실제 수정 부담은 없을 것으로 보이나 전달 문서에 `reference`를 적어 보냈다면 정정이 필요하다.

## 검증 수준 구분

세 단계를 섞어 읽지 않는다.

| 단계 | 무엇을 했나 | 어디 |
|---|---|---|
| ① JVM 테스트 | mock·synthetic 입력. 상태 전이·경계·동시성 시나리오 | §1 |
| ② 실제 PostgreSQL 읽기 전용 | 카탈로그 조회, CHECK 표현식 SELECT 평가. **DDL을 적용하지 않고** 식만 확인 | §2 |
| ③ 미검증 | 실제 DDL 적용, Mapper SQL 실행, 동시성, 실제 GMS, 배포 환경 E2E | §3 |

## 1. 자동 검증 — JVM 테스트 (mock/synthetic, 통과)

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
BUILD SUCCESSFUL in 2m 10s
```

`7da66b39`에서 실행했다. `backend/build/test-results/test/*.xml` 집계: 총 832개 중 72개는 기존 조건부
테스트로 skipped, 실행된 760개는 failure 0, error 0.

컬럼 축소(`910e4ac2`·`a18cd16a`)와 버전 통합(`7da66b39`) 전후로 개수가 같다 — 테스트가 삭제·비활성된 것이 아니라
`TasteAnalysisClaimMapperTests`·`TasteAnalysisGenerationServiceTests`·`TasteAnalysisLifecycleTests` 등이
새 스키마에 맞게 수정된 뒤 통과했다. `7da66b39`에서는 `TasteSnapshotHasherTests`·`TasteReferenceLoaderTests`를
포함해 테스트 9개와 fixture가 `analysisVersion` 단일 버전으로 함께 바뀌었다. `items` → `content` 리네임(`c599114b`)도 개수 변동이 없고
`MusicLikeControllerTests`·`MusicLikeServiceTests`가 함께 통과했다.

## 2. 실제 PostgreSQL 읽기 전용 확인 (부분)

운영 `ody` DB에 **읽기 전용으로만** 접근해 확인한 것이다. **DDL을 적용하지 않았고 운영 데이터를 바꾸지 않았다.**

| 확인한 것 | 결과 |
|---|---|
| `music_like`·`taste_analysis` 존재 여부 | **둘 다 없음** (2026-09-22 09:09 KST, 전체 스키마 기준). `music`, `playlist_like`는 존재 |
| `ROW(...) IS NOT NULL` 필수값 검사 | SELECT로 식을 평가해 의도대로 동작함을 확인 |
| PENDING의 NULL lease 거부 | SELECT로 식을 평가해 거부됨을 확인 |

**이것은 DDL 적용·Mapper SQL 실행·동시 claim 검증을 대체하지 않는다.** 식이 맞다는 것과
그 식이 걸린 테이블에서 동시 요청이 의도대로 직렬화된다는 것은 다른 이야기다.

## 3. 아직 검증하지 않은 것 (완료로 표시하지 않는다)

| 항목 | 현재 상태 | 필요한 것 |
|---|---|---|
| 실제 DDL 적용 | **미실행.** staging·운영 어디에도 두 테이블이 없다 | Data/DB 파트 |
| Mapper SQL 실제 실행 | **미검증.** T049는 `taste_analysis_001_table.sql`과 `TasteAnalysisMapper.xml`의 **문자열 계약 테스트**다. 저장소에 Testcontainers 의존성이 없어 실제 DB에 SQL을 보내는 테스트가 없다 | Data/DB 파트가 staging PostgreSQL에서 재현 |
| 동시 claim·partial unique index·lease 회수 | **미검증.** JVM 테스트는 mock mapper 기준이고, §2는 식 평가까지다 | 실제 테이블에서 동시 요청 재현 |
| 실제 GMS 호출 | **미검증.** `GmsTasteClientTests`는 MockRestServiceServer 기반이다. 실제 `GMS_KEY`로 호출한 적이 없다 | Infra의 secret 주입 + staging 1회 호출 |
| `taste-reference-v1.json` | **없음.** 기본 설정에서 취향 분석 API는 `TASTE_REFERENCE_UNAVAILABLE`(503)을 반환한다. 테스트는 fixture로만 통과한다 | Data 파트의 승인된 기준 산출물 |
| SC-003 성능 (분포/기존 리포트 p95 3초, 신규 생성 p95 30초) | **미측정.** 동시 사용자 10명·100회 측정 없음 (T065) | Infra + 실제 환경 |
| SC-001 반복 조회 20회 동일성 | **부분.** 통계 계산의 결정성은 단위 테스트로 확인했으나 명세가 요구하는 20회 반복 실행 근거는 없다 | 실행 기록 추가 또는 SC 문구 조정 합의 |
| SC-002 사전 정의 사례 20개 | **부분.** 고저 집중·경계·누락 등 일부만 테스트에 있고 20개 사례가 문서로 고정돼 있지 않다 | 사례 목록 확정 후 테스트 보강 |
| SC-005 사용자 이해도 | **해당 태스크 없음.** 5명 사용성 검토를 수행할 태스크가 tasks.md에 없다 | Frontend 완료 후 기획과 일정 합의 |
| 근거 없는 LLM 추론 차단 | **부분.** 현재 검증은 승인된 finding id·axisPhrase 화이트리스트와 금지어 기반이다. "근거 없는 추론을 전부 차단"이라는 명세 문구보다 좁다 | 명세 문구를 구현 범위에 맞추거나 검증 방식 확장 합의 |
| metrics 운영 확인 절차 | **미정.** counter/timer는 구현돼 있으나 어떤 Prometheus query로 무엇을 보는지 문서가 없다 | Infra 파트 (T067) |
| T001–T003 승인 게이트 | **미완료 상태에서 구현이 선행됐다.** 기능 명세·API·축 라벨 승인을 받지 않은 채 코드가 먼저 나왔다 | 기획/Frontend/Data 승인 후 문서 동기화 |

## 4. 배포 전 필수 항목

### Data/DB 파트

- `music_like_001_table.sql`, `taste_analysis_001_table.sql`을 검토해 staging·운영 PostgreSQL에 적용한다.
  **최초에 전달한 SQL 대신 현재 수정본을 쓴다.** 두 파일 모두 `CONCURRENTLY`를 쓰지 않으므로
  하나의 트랜잭션으로 실행할 수 있다 — 이전 안내(트랜잭션 분리 필요)는 `910e4ac2`로 무효가 됐다.
- 실제 PostgreSQL에서 claim, partial unique index, lease 회수와 FK/index 동작을 검증한다 (§3).
- 승인된 `taste-reference-v1.json`과 checksum/lineage를 생성해 Backend에 전달한다.
  기존 PC 좌표계를 그대로 쓴다 — **PCA 재수행은 이 작업의 후속으로 추가하지 않는다.**

### Frontend 파트

- 곡 좋아요 UI와 최근 좋아요순 가상 플레이리스트를 기존 재생 큐에 연결한다.
- PC 분포 차트, 분석 생성 버튼, 1일 1회 제한, 생성 상태, 마지막 갱신 시각, STALE과 오류 상태를 표시한다.
- 계약은 `docs/rules/BACKEND-NOTES.md` A-48~A-51 참고. 컬럼 축소(`910e4ac2`·`a18cd16a`)는 계약에 영향이 없지만 **버전 통합(`7da66b39`)은 응답을 바꿨다** — `reference` 객체가 `analysisVersion` 문자열로 대체됐다.

### Infra 파트

- 운영 서버 secret 환경변수로 **`GMS_KEY`** 를 주입하고(`GMS_API_KEY` 아님) `gms.ssafy.io:443` outbound HTTPS를 허용한다.
- 실제 GMS staging 호출과 key·Authorization header 비노출을 검증한다.
- Actuator/Prometheus 지표 노출과 SC-003 성능을 측정한다.
