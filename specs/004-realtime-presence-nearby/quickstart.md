# Quickstart / Validation: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contracts**: [realtime-websocket.md](contracts/realtime-websocket.md) · [music-play.md](contracts/music-play.md) | **Date**: 2026-09-10

검증 결과는 **통과·실패·미실행**을 구분한다(헌법 III). 미실행을 통과로 보고하지 않는다.
B-2~B-7에 의존하는 기대값은 확정 후 보완한다(Q1~Q3는 2026-09-10 해소).

## 0. 게이트 — 지금 바로 (구현 전)

| 검사 | 명령 | 기대 | 현재 상태 |
| --- | --- | --- | --- |
| 컨텍스트 로딩 | `cd backend && ./gradlew test --tests com.ssafy.backend.BackendApplicationTests` | 통과 | **실패(09-10 07:05)** → `RealtimeMapperScanConfig` 추가 후 **재실행 필요** |
| 기존 테스트 회귀 | `./gradlew test` | Hello·Music 5종 26건 통과 유지 | 09-10 07:05 통과 |
| 빌드 | `./gradlew build` | `build/libs/app.jar` | 09-10 07:05 생성됨 |

`BackendApplicationTests`는 `test` 프로파일(H2, Redis localhost:6379 무인증)로 뜬다. Redis 접속은 지연 초기화라 컨텍스트 로딩에는 Redis가 필요 없다 — 단 `RedisScriptConfig`의 `ClassPathResource`가 Lua 파일을 찾아야 하므로 스크립트 파일명 교체 시 함께 갱신.

## 1. 사전 조건

- JDK 17(Gradle `release 17`), Gradle wrapper 9.7.1 (`backend/gradlew`, Windows `gradlew.bat`).
- 로컬 인프라: `python scripts/local/dev.py up` — **단 `.env.local.example`이 저장소에 없어 `init`이 실패한다**(09-10 확인). `.env.local`을 수동 작성(dev.py `REQUIRED` 14키) + `backend/.env`(`.env.example` 복사, `JWT_SECRET` 32B+).
- Redis 설정 확인: `redis-cli CONFIG GET maxmemory-policy` → `noeviction` (FR-025). `infra/local/docker-compose.yml`의 redis command에 `--maxmemory-policy noeviction` 추가 요청 **[Infra]**.
- 실시간만 개발할 때: Postgres·Neo4j 없이 Redis만으로 뜨는 프로파일이 **없다**(`local`은 db 프로파일 동반). `standalone` + Redis 조합 프로파일 추가는 tasks T004.
- STOMP 클라이언트: 테스트는 `WebSocketStompClient`(spring-websocket 포함). 수동 확인은 브라우저 devtools 또는 `websocat`.

## 2. 순수 단위 검증 (프레임워크·Redis 불필요) — 착수 즉시

| 시나리오 | 검증 | 위치 |
| --- | --- | --- |
| FR-031 | `Normalizer`: `(pc-min)/(max-min)`; pc=min→0, pc=max→1(셀 15로 클램프), pc<min→셀 0(음수 floor 확인), pc>max→셀 15 | `geometry/NormalizerTests` |
| FR-031 | `(int)` 캐스팅 회귀 방지: pc=-0.3, min=-1, max=1 → x_norm=0.35 → 셀 5. pc=-1.5(구간 밖) → floor(-4)=-4 → 클램프 0 (캐스팅이면 -4→0이라 우연히 같음 — pc=-0.06,min=0,max=1: floor(-0.96)=-1→0 vs (int)(-0.96)=0 구분 불가; **pc=-1.2,min=-1,max=1: x_norm=-0.1, floor(-1.6)=-2→0, (int)(-1.6)=-1→0** — 클램프 후 동일. 따라서 클램프 전 값을 단언) | 〃 |
| FR-050 | `CellGrid.cellsFor(viewport)`: 화면이 셀 경계에 걸칠 때 양쪽 셀 포함; 1셀~256셀 | `geometry/CellGridTests` |
| FR-052, 058 | `Viewport.contains(x, y)` 사각형 판정 — 경계 포함 규칙 명시(양끝 포함으로 시작) | `geometry/ViewportTests` |
| FR-053 | `Viewport.satisfiesBounds(pc[16], bounds)` — 한 축이라도 벗어나면 false | 〃 |
| FR-055 | 36셀 → INDIVIDUAL, 37셀 → CLUSTERED | `viewport/ModeDecisionTests` |
| FR-062 | 마커 100개(16×16) → 8×8로 접어 ≤64; 65개 → 접힘; 64개 → 그대로. 접힌 count = 자식 합 | `geometry/CellGridFoldTests` |
| FR-057, 074 | `DeltaClassifier`: `old={a,b}, new={b,c}` → LEAVE {a}, ENTER {c}, MOVE {b}; old==new 셀 → 전원 MOVE | `common/DeltaClassifierTests` |
| FR-081 | `MeetingPair.of("b@x","a@x")` → (a@x, b@x); 자기 자신 → 빈 | `meeting/MeetingPairTests` |
| FR-014 | `PlayDeclarationService` no-op 분기: old==new → Lua·EventBus·Meeting 호출 0회, play_history INSERT 1회 (mock) | `presence/PlayDeclarationServiceTests` |

## 3. Redis 통합 검증 (로컬 Redis 필요, `@EnabledIf` 조건부)

| 시나리오 | 검증 |
| --- | --- |
| A3, A4, FR-013 | `presence-play.lua`: 빈 상태 → play X → `listeners:X={e}`, `active-song:cell:{L}:{cx}:{cy}={X}`, `usercount[cx:cy]=1`, presence 갱신. play Y → X에서 빠짐·셀에서 X 제거(마지막)·usercount 필드 삭제, Y 등록 |
| A12, FR-019 | `presence-play.lua` old 불일치 → 반환 -1, 상태 무변경 |
| A50 | `presence-play.lua` 반환값 = 진입 직전 청취자 목록 (e1,e2 있을 때 e3 진입 → [e1,e2]) |
| A10, FR-021 | `presence-leave.lua` + 메타 해제: 6종 키 잔여 0. `SCAN` + `SCARD`로 빈 Set 없음 단언 |
| A11, FR-022~024 | `presence:expiry` score 조작 → Sweep 1회 → 정리. Sweep 중 동시 play → 새 곡 청취자 보존(스크립트 안 읽기) |
| A13, FR-005 | epoch 2로 재접속 후 epoch 1 leave → no-op |
| A30, FR-064 | usercount를 임의로 어긋나게 `HSET` → recount → 복구 + WARN 로그 + `realtime.recount.mismatch` 증가 |
| FR-063, 077 | 구독 등록 후 yml grid 변경 시뮬레이션 → 해제가 저장 cellKeys로 되어 누수 0 |

## 4. STOMP E2E (2세션, 로컬 Redis 필요)

`WebSocketStompClient` 2개(A, B) + `test` 프로파일 JWT(`JwtTokenProvider.createAccessToken("a@test")`).

| 시나리오 | 절차 | 기대 |
| --- | --- | --- |
| A1, A2 | 유효 토큰 CONNECT / 무토큰 CONNECT | 성립 / 거부 |
| A20, A21, A22 | A: play X(좌표 캐시 스텁). B: viewport(X 포함 사각형) → 스냅샷; viewport(X 셀 포함·사각형 밖) → 미포함; bounds로 X 축 배제 → 미포함 | `groups` 유무 |
| A23, A24 | B: 넓은 viewport(>36셀) → `mode=CLUSTERED`, `resolution`, `cells`, 개별 정보 없음. 마커 >64 fixture → 접힘 | |
| A25, A26 | B INDIVIDUAL 구독 중 A: play Y(같은 셀) → B `VIEWPORT_MOVE`; play Z(다른 셀, B 화면 안) → `LEAVE`+`ENTER`; Z가 B 사각형 밖 → 미발송 | |
| A27, A28 | B: CLUSTERED 전환 → 이후 A 이동에 델타 0건. B: layer 변경 viewport → B 셀 재계산·구독 교체 | |
| A29 | B 스냅샷 seq=N 직후 지연 델타 seq≤N 재생(테스트 훅) → 클라이언트 폐기 규칙 확인은 FE 몫; 서버는 seq 단조 증가만 단언 | |
| A40~A45 | `findNeighbors` 스텁: X → [Y, Z]. C: play Y. A: play X → `nearby/open` → 그룹 Y에 C, X 그룹(A 제외 → 0명 → 생략). C: play Z → A `NEARBY_MOVE`; play W(비이웃) → `LEAVE`; A: `nearby/close` → C 이동에 델타 0건 | |
| A50~A54 | A: play X. B: play X → `meeting(a,b).cnt=1` (H2/Postgres). B: play X 재선언 → 1 유지. B: play Z → play X → 2. 1,000명 fixture → 배치 1문 + `realtime.meeting.batch.size` | DB 단언 |
| A8, A9 | `PATCH /music/play/end` 소유자/타인 | 200 / 403 |

## 5. 성능·관측 (FR-090, SC-001~003)

- 지표 노출: `GET /actuator/prometheus`에 `realtime_*` 9종 존재.
- SC-001·002: E2E에서 `play` 호출 시각 → B 수신 `ts` 차이. 목표 1초. **백분위·동접 조건은 미정** — 임의 기준을 만들지 않고 측정값을 기록.
- SC-003: 하트비트 중단 → 사라지는 시각 45~50초.
- email 노출 0건: E2E 수신 프레임 전체를 정규식 `@`로 스캔 + 로그 파일 스캔.
- `realtime.normalize.clamped` 비율: B-4 임의 상수 부적합의 신호. 실데이터에서 5% 초과면 min/max 재조정.

## 6. 미정으로 보류 (기대값 확정 전 실행하지 않음)

| 보류 | 의존 |
| --- | --- |
| join `musicId` 대조 방어 켤지 여부(A14의 불일치 케이스) | FE2 확인 |
| `/api` 프리픽스 정리·`SecurityConfig` authenticated | B-6 |
| `play_history`·`meeting` 실컬럼, `meeting(user1,user2)` UNIQUE | B-2 |
| `findNeighbors` 실호출(스텁 제거), `MusicLocationReader` | B-3 |
| 축 배정·min/max 실측값으로 시연 | B-4 |
| `ViewportRequest.bounds`·`resolution` FE 확정 | B-5 |
| Testcontainers 전환 | B-6 |
| 2인스턴스 fanout | B-7 |
