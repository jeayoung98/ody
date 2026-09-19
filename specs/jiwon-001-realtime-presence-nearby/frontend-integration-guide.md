# Realtime(실시간 위치·주변 사람) 프론트 연동 가이드

- 기준: 백엔드 `backend/dev` + `backend/fix/S15P21A405-429-realtime-hotfix` (2026-09-18, **레이어 0-based·표시 좌표 원시 PC 로 계약 변경 반영**), 프론트 `origin/frontend/dev @ a181179`
- 대상: FE 담당자. "지금 프론트가 어떻게 돼 있고 → 백엔드는 무엇을 기대하고 → 어디를 어떻게 바꾸면 되는지"만 적었다.
- 이 문서가 기존 `specs/jiwon-001-realtime-presence-nearby/frontend-integration-guide.md`(2026-09-16 기준)를 대체한다. 그 문서의 "뷰포트 미구현·join이 요청 musicId 사용·playEnd 422·play.layer 없음"은 전부 옛 정보다.
- 상세 계약 원문: `specs/jiwon-003-realtime-viewport/contracts/realtime-viewport-websocket.md`, `specs/jiwon-001-.../contracts/music-play.md`

---

## 0. 먼저 알아야 할 것 — 지금 프론트 구조로는 붙지 않는다. 무엇을 어떻게 바꿔야 하나

실시간 기능은 **"이 사용자가 지금 어디 서 있나"** 를 다루기 때문에 사용자별 인증이 전제다. 현재 프론트(유저 테스트 구성)는 그 전제와 정반대로 되어 있다. 아래 0.1 ~ 0.6 을 순서대로 처리해야 §1 이후가 동작한다.

### 0.1 진단 — 지금 구조가 왜 안 되는가

| 지금 프론트 | 왜 문제인가 |
| --- | --- |
| 로그인이 목(`SKIP_LOGIN`, `/bff/auth/*`). 브라우저에 백엔드가 인정하는 accessToken 이 없다 | presence·play·nearby 는 전부 **토큰 subject(email)** 로 사용자를 정한다. 토큰 없이는 누구의 위치인지 정할 수 없다 |
| 실데이터 호출은 `src/app/bff/*` 라우트가 **서버 토큰(`BACKEND_ACCESS_TOKEN`)** 으로 대신 부른다 (`lib/backend.ts`) | 서버 토큰으로 play 를 치면 **모든 사용자가 한 계정으로 이동**한다. 실시간 API 는 BFF 대리호출 불가 |
| 브라우저는 백엔드를 직접 부르지 않고 Next rewrite 만 탄다 (`next.config.ts`, `LIVE_API_PATHS` 는 비어 있음) | Next rewrite 는 **WebSocket Upgrade 를 프록시하지 않는다.** BFF 라우트 핸들러도 못 한다 |
| STOMP 라이브러리 없음 (`package.json`) | — |
| 배포 nginx 는 `/api/` 만 백엔드로 넘긴다 (BACKEND-NOTES B-16) | `/ws` 가 백엔드에 닿지 않는다 |
| 백엔드 `SecurityConfig` 가 지금 `anyRequest().permitAll()` (데모용 임시) | permitAll 이면 컨트롤러 `Principal` 이 null → play/nearby 가 500. 백엔드(지원)가 원복해야 한다 |

### 0.2 인증 — 실로그인을 살린다 (필수, 가장 먼저)

실시간은 **진짜 accessToken 이 브라우저에 있어야** 시작된다. 백엔드 `/api/auth/*` 는 이미 다 있고, 프론트도 실연동 코드가 남아 있어 "되돌리기"에 가깝다.

| 순서 | 파일 | 할 일 |
| --- | --- | --- |
| 1 | `constants/live-api-paths.ts` | 주석 처리된 `/api/auth/signup` `/api/auth/login` `/api/auth/login/google` `/api/auth/exchange` `/api/auth/reissue` `/api/auth/logout` `/api/auth/withdraw` `/api/users/nickname-available` `/api/user/tutorial-completed` `/api/user/profile` `/oauth2/authorization/:provider` `/login/oauth2/code/:provider` 주석 해제 |
| 2 | `constants/api-endpoints.ts` `auth.*` | `me` → 백엔드 본인 조회(A-15 확인 필요, 없으면 토큰 payload 의 email 을 쓰거나 `GET /api/user/detail?email=` 로 대체), `logout` → `/api/auth/logout`, `signup` → `/api/auth/signup`, `login` → `/api/auth/login`, `nickname` → `PATCH /api/user/profile`, `completeTutorial` → `PATCH /api/user/tutorial-completed` |
| 3 | `constants/auth.ts` `SKIP_LOGIN` / `NEXT_PUBLIC_TEST_TOOLS` | 실시간을 켤 빌드에서는 로그인 게이트를 다시 태운다. 유저 테스트 빌드(게이트 생략)에서는 실시간을 **`FEATURES.social` 로 함께 끈다** — 토큰 없는 사용자가 소켓을 열어 `REALTIME_AUTH_MISSING` 으로 튕기는 것을 막는다 |
| 4 | `lib/api.ts` | 이미 `Authorization: Bearer` 를 붙이고 401 이면 `reissueAccessToken()` 을 탄다. 그대로 쓴다. 소켓 CONNECT 거부 시에도 같은 함수를 재사용 (§1.1) |
| 5 | 백엔드(BE1) | 로컬 개발용 `CORS_ALLOWED_ORIGINS` 에 `http://localhost:3000` 추가 요청. rewrite 는 브라우저 `Origin` 을 그대로 넘겨서(S15P21A405-303) 로컬에서만 403 이 난다. 배포는 동일 오리진이라 무관 |

> 유저 테스트 기간과 겹치면: **실시간은 `FEATURES.social` 뒤에 둔다.** 이 스위치는 이미 "지도 위 사람·주변 사람 탭·따라가기·반응"을 한 번에 여닫고 있어서(`use-nearby-users-query.ts` 주석) 자리가 맞다. 소켓 연결 자체를 `features.social && hasAccessToken` 일 때만 시작하면 된다.

### 0.3 실시간 REST 3개 — BFF 가 아니라 브라우저가 자기 토큰으로 직접

`POST /api/music/play` · `PATCH /api/music/play/end` · `POST /api/realtime/nearby` 는 **`/bff/` 를 만들지 않는다.** `lib/api.ts` 로 바로 부르고 rewrite 통과 목록에 넣는다.

| 파일 | 할 일 |
| --- | --- |
| `constants/live-api-paths.ts` | `"/api/music/play"`, `"/api/music/play/end"`, `"/api/realtime/nearby"` 추가 |
| `constants/api-endpoints.ts` | `music.play` 를 `/bff/music/{id}/play` 에서 **`"/api/music/play"`** 로(곡 ID 는 본문). `music.playEnd: "/api/music/play/end"`, `realtime.nearby: "/api/realtime/nearby"` 추가 |
| `src/app/bff/users/nearby/route.ts` | 실연동에서는 쓰지 않는다. `USE_MOCK_API=1` 목 전용으로 남기거나 삭제 |
| `docs/rules/BACKEND-NOTES.md` | "실시간 3개 REST 는 BFF 대리호출 금지(사용자 토큰 필수)" 항목 추가 — 나중에 누가 `backendPost` 로 옮기지 않게 |

### 0.4 WebSocket — 브라우저가 백엔드 `/ws` 에 직접 연결

| 항목 | 할 일 |
| --- | --- |
| 의존성 | `npm i @stomp/stompjs` (SockJS 불필요 — 원시 WebSocket 으로 붙는다) |
| 주소 | 새 환경변수 `NEXT_PUBLIC_WS_ORIGIN`. 비면 `location.origin` 의 `http`→`ws` 치환. 배포 `wss://j15a405.p.ssafy.io`, 로컬 `ws://localhost:8080`. **rewrite 를 거치지 않는다** — `BASE_URL` 이 빈 것과 무관하게 절대 주소로 연다 |
| 엔드포인트 | `${WS_ORIGIN}/ws/websocket` (§1.1). 백엔드 `/ws` 는 SockJS 엔드포인트인데 `/ws/websocket` 이 원시 WebSocket 진입점이다 |
| 인증 | CONNECT 헤더 `Authorization: Bearer {accessToken}`. `readStorage(STORAGE_KEYS.accessToken)` 그대로 |
| 인프라 요청 | nginx 에 `location /ws/ { proxy_pass 백엔드; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 60s 이상; }` 추가. 백엔드는 `spring.profiles.active` 에 `realtime` 포함 + Redis 연결. **이게 없으면 배포에서 소켓이 아예 안 열린다** — 프론트 작업 전에 인프라 담당에게 먼저 요청 |
| 로컬 확인 | 브라우저 콘솔에서 `new WebSocket("ws://localhost:8080/ws/websocket")` 이 101 로 열리면 준비 끝(인증은 STOMP CONNECT 프레임에서 하므로 여기까지는 토큰 없이 열린다) |

### 0.5 레이어 번호 — 변환 없음 (2026-09-18 백엔드 변경)

실시간 계약(`/app/presence/join` · `/app/presence/viewport` · `POST /api/music/play` · 모든 응답)의 `layer` 는 **프론트와 같은 0-based(0~7)** 다. `useMapStore.layer`, `LayerBox.layer` 를 **그대로** 보낸다. `ancestorBounds` 도 `boxes` 의 `layer` 그대로.
유일한 예외는 BE2 소유의 `GET /api/music/major` — 여기만 예전대로 `level = boxes.length + 1`(1-based) 이다. 실시간 코드에서 `+1` 을 하면 **레이어가 한 겹 어긋난다.**

### 0.6 좌표계 — 전부 원시 PC (2026-09-18 백엔드 변경)

실시간에서 오가는 `x`·`y` 는 **모두 엔진 월드 좌표(원시 PC 값)** 다: 뷰포트 요청 `minX..maxY`·`ancestorBounds`, 스냅샷 `groups[].x/y`, 셀 인원수 `cells[].x/y`, 델타 `x/y`, `PlayResponse.x/y`. 정규화(0~1) 값은 서버 내부 셀 계산에만 쓰고 밖으로 내지 않는다. 프론트는 변환 없이 `worldToScreen` 에 넣으면 된다.

### 0.7 작업 순서 (권장)

```
[인프라] nginx /ws 프록시 + realtime 프로파일          ← 프론트 작업과 병행, 가장 먼저 요청
[BE]     SecurityConfig permitAll 원복, CORS localhost   ← 지원·BE1
[FE-1]   0.2 실로그인 복구 → 브라우저에 accessToken
[FE-2]   0.3 REST 경로 3개 + use-record-play-mutation 수정 (§3)   ← 소켓 없이도 play 는 422 로 "미연결" 확인 가능
[FE-3]   0.4 stomp-client + join + heartbeat (§1·§2)              ← 콘솔에서 PRESENCE_JOINED 확인
[FE-4]   뷰포트 훅 → 지도 위 사람 교체 (§4)
[FE-5]   주변 사람 패널 실연동 (§5)
[FE-6]   목 코드 정리 (use-nearby-users-query / bff/users/nearby / mocks/user / use-mock-friend-reactions → USE_MOCK_API 전용)
```

---

## 1. WebSocket 연결 (STOMP)

### 1.1 서버 설정 (`WebSocketConfig`, `WebSocketAuthInterceptor`)

| 항목 | 값 |
| --- | --- |
| 엔드포인트 | `/ws` (SockJS 활성). **원시 WebSocket 은 `/ws/websocket`** — SockJS 없이 붙을 때 이 주소 |
| 허용 Origin | `*` (엔드포인트 단) |
| 인증 | STOMP `CONNECT` 프레임의 native 헤더 `Authorization: Bearer {accessToken}`. 없거나 access 토큰이 아니면 연결 거부 |
| 앱 prefix | `/app` (C→S 전송은 전부 `/app/...`) |
| 개인 큐 | `/user/queue/presence` (모든 데이터), `/user/queue/errors` (오류). **토픽 브로드캐스트 없음** — 구독은 이 둘만 |

```ts
import { Client } from "@stomp/stompjs";

const client = new Client({
  brokerURL: `${WS_ORIGIN}/ws/websocket`,       // wss://j15a405.p.ssafy.io/ws/websocket (로컬: ws://localhost:8080/ws/websocket)
  connectHeaders: { Authorization: `Bearer ${readStorage(STORAGE_KEYS.accessToken)}` },
  reconnectDelay: 3000,
  onConnect: () => {
    client.subscribe("/user/queue/presence", onPresence);
    client.subscribe("/user/queue/errors", onError);
    join(useMapStore.getState().layer);         // §2 — 0-based 그대로. 재연결 때마다 다시 보낸다
    startHeartbeat();                            // §1.3
  },
});
client.activate();
```

- 로컬에서 SockJS(`/ws` + `sockjs-client`)를 쓰면 `/ws/info` XHR 이 CORS 를 타서 `localhost:3000` 이 403 날 수 있다. **원시 WebSocket(`/ws/websocket`)을 권장** — Upgrade 요청은 preflight 가 없다.
- `NEXT_PUBLIC_API_URL` 은 비워 두는 구조라 WS 주소용 환경변수를 하나 새로 둔다 (예: `NEXT_PUBLIC_WS_ORIGIN`, 비면 `location.origin` 을 `wss://` 로 바꿔 쓴다).
- 토큰이 만료돼 CONNECT 가 거부되면 `api.ts` 의 `reissueAccessToken()` 을 태운 뒤 재연결한다.

### 1.2 S→C 봉투 — 모든 수신 프레임은 이 모양이다

```json
{ "type": "VIEWPORT_SNAPSHOT", "seq": 41, "ts": 1789700000000, "payload": { ... } }
```

| 필드 | 뜻 |
| --- | --- |
| `type` | `PRESENCE_JOINED` · `VIEWPORT_SNAPSHOT` · `VIEWPORT_ENTER` · `VIEWPORT_MOVE` · `VIEWPORT_LEAVE` · `VIEWPORT_CELL_COUNTS` · `NEARBY_SNAPSHOT` · `NEARBY_ENTER` · `NEARBY_MOVE` · `NEARBY_LEAVE` · `PRESENCE_ERROR` |
| `seq` | **사용자 단위 단조 증가.** 마지막으로 처리한 seq 보다 작거나 같으면 버린다(순서 역전). 주변 사람 `snapshotSeq` 비교에도 쓴다(§5) |
| `ts` | 서버 epoch ms |
| `payload` | 타입별 본문 (아래 각 절) |

REST 의 `{success, data, error}` 봉투는 WS 에 **적용되지 않는다.** `api.ts` 를 거치지 않으므로 별도 파서를 둔다.

### 1.3 heartbeat / leave / resync

| 목적지 | 본문 | 주기·시점 | 비고 |
| --- | --- | --- | --- |
| `/app/presence/heartbeat` | 없음 | **15초**마다 (`realtime.presence.heartbeat-interval-ms`) | TTL 45초. 3번 놓치면 서버가 지도에서 뺀다. 만료 뒤 보내면 `PRESENCE_STALE` → 재연결·재join |
| `/app/presence/leave` | 없음 | 탭 닫힘(`pagehide`) 등 명시 종료 | 안 보내도 DISCONNECT 로 정리된다. 보내면 즉시 사라진다 |
| `/app/presence/resync` | 없음 | 쓸 일 거의 없음 | 서버는 상태를 복원해 주지 않고 `PRESENCE_STALE` 로 "join·viewport 다시 보내라"고만 답한다. 즉 **재연결 후 복원은 클라이언트 책임** |

멀티탭: 위치는 공유되고 **조종권은 마지막에 연결한 탭**에 있다. 이전 탭이 join/viewport 를 보내면 `PRESENCE_STALE` 이 온다 → 그 탭은 "다른 탭에서 사용 중" 처리(재시도 금지).

---

## 2. 입장(join) — 내 위치를 지도에 올린다

`/app/presence/join`

```json
{ "requestSeq": 1, "layer": 2, "musicId": 8812 }
```

| 필드 | 규칙 |
| --- | --- |
| `requestSeq` | 1 이상, 클라이언트 단조 증가. 응답·오류에 그대로 돌아온다 |
| `layer` | **0~7, `useMapStore.layer` 그대로** (변환 없음) |
| `musicId` | 1 이상. **참고값이다.** 서버는 첫 입장이면 `play_history` 최신 곡, 그 뒤는 서버에 남은 현재 곡을 쓴다. 실제 적용 곡은 응답으로 알려준다. `STORAGE_KEYS.playingMusicId ?? myMusicId` 를 넣고, 없으면 임의의 양수를 넣어도 된다 |

응답 `PRESENCE_JOINED` (`/user/queue/presence`):

```json
{ "type": "PRESENCE_JOINED", "seq": 3, "ts": 0, "payload": { "requestSeq": 1, "layer": 2, "musicId": 8812 } }
```

→ `payload.musicId` 로 **내 표식 위치(`myMusicId`/`currentMusicId`)를 맞춘다.** 요청과 다르면 서버 값이 정답이다(예: 다른 탭에서 곡을 바꿨다).

### 2.1 언제 보내나

1. 연결 직후(구독 후) — 현재 겹으로.
2. **겹이 바뀔 때마다** (`useMapStore.layer` 변경: 파고들기·떠오르기·스테퍼). 곡은 그대로, 레이어만 옮기는 join.
3. 재연결 직후.

### 2.2 새 사용자 흐름 — join 이 거부되는 유일한 정상 케이스

재생 기록이 한 번도 없는 사용자는 서 있을 곡이 없어서 join 이 `PRESENCE_NO_ANCHOR` 로 거부된다. **이건 오류 화면이 아니다.** 흐름:

```
연결 → join → PRESENCE_ERROR{code: PRESENCE_NO_ANCHOR}
  → 지도는 그대로 보이고, 내 표식만 없다 (튜토리얼 "곡을 골라 재생하세요" 상태)
  → 사용자가 첫 곡 재생 → POST /api/music/play { musicId, source, layer: useMapStore.layer }   ← layer 필수(§3)
  → 서버가 그 곡·그 레이어에 첫 자리를 잡는다 (응답 x,y,layer)
  → 이후 겹 이동은 평소처럼 join
```

첫 play 에 `layer` 를 안 넣으면 422 `PRESENCE_ERROR` 다. 이미 서 있는 사용자의 play 에 넣은 `layer` 는 **무시**된다(레이어는 join 으로만 바뀐다).

---

## 3. 재생 선언·종료 REST — 위치 이동의 유일한 원본

### 3.1 지금 프론트

`hooks/mutations/use-record-play-mutation.ts` 가 `POST /bff/music/{id}/play { source, playedMs: 0 }` 를 쏘고 응답 `{ok}` 를 버린다. 호출 지점 3곳: `map-view.tsx` `playSong`, `use-song-play-toggle.ts` `toggle`, (여정·플리 재생 쪽도 같은 훅). 종료 시각은 어디서도 기록하지 않는다.

### 3.2 백엔드가 기대하는 것

| | 요청 | 응답(`data`) | 오류 |
| --- | --- | --- | --- |
| `POST /api/music/play` | `{ "musicId": 8812, "source": "MAP", "layer": 2 }` · `source` ∈ `MAP·JOURNEY·PLAYLIST·FOLLOW` · `layer` 0~7(0-based, 현재 `useMapStore.layer`), **첫 배치일 때만 의미** (그 외 생략 가능) | `{ "playHistoryId": 501, "musicId": 8812, "layer": 2, "x": 0.37, "y": 1.24, "cellX": 6, "cellY": 12 }` — `x,y` 는 그 레이어 표시축의 **원시 PC 좌표**(엔진 월드 좌표 그대로), `cellX/Y` 는 디버깅용 | 400 `VALIDATION_ERROR`(source 오타·musicId 없음) · 404 `MUSIC_NOT_FOUND` · 422 `PRESENCE_ERROR`(소켓 미연결 / 첫 배치인데 layer 없음 / 곡 좌표 없음 / 처리 중 접속 바뀜) |
| `PATCH /api/music/play/end` | `{ "playHistoryId": 501, "playedMs": 183000 }` · `playedMs` ≥ 0, 멱등(마지막 값으로 덮어씀) | `null` | 400 `VALIDATION_ERROR` · **403 `FORBIDDEN`**(내 기록이 아니거나 없는 ID — 둘을 구분하지 않는다) |

- play 는 **소켓이 연결돼 있어야** 성공한다(`PRESENCE_NOT_CONNECTED` → 422). 재생 버튼은 소켓 연결 뒤에 살리거나, 422 면 토스트로 "연결 중" 안내.
- play 한 번 = `play_history` 한 줄 + `music.play_cnt +1`. 같은 곡 다시 눌러도 기록은 쌓인다(위치 변경 알림만 안 나간다). 일시정지→재개는 play 를 다시 치지 말고 end 만 갱신.
- 곡 위치는 **서버가 계산**한다. 좌표를 보내지 않는다(위치 조작 방지).

### 3.3 프론트 수정

| 파일 | 수정 |
| --- | --- |
| `constants/api-endpoints.ts` | `music.play` 를 `"/api/music/play"` 로, `music.playEnd: "/api/music/play/end"` 추가. `/bff/` 가 아니라 `/api/` 다(브라우저 자기 토큰) |
| `constants/live-api-paths.ts` | `"/api/music/play"`, `"/api/music/play/end"`, `"/api/realtime/nearby"` 추가 (rewrite 통과 목록) |
| `hooks/mutations/use-record-play-mutation.ts` | 본문 `{ musicId, source, layer? }`, 응답 타입 `PlayResponse`. `playedMs` 제거. 성공 시 `playHistoryId` 를 플레이어 스토어(또는 ref)에 보관 |
| 새 `hooks/mutations/use-play-end-mutation.ts` | `PATCH /api/music/play/end { playHistoryId, playedMs }` |
| `stores/use-player-store.ts` | `playHistoryId: number \| null`, `startedAt`. `playSeq` 가 바뀌거나 `stop/pause→다음 곡` 될 때 이전 곡의 end 를 보낸다 |
| `lib/playback-events.ts` 구독자 | 실제 플레이어가 `ended`/`paused` 를 보고할 때 `playedMs` 누적 → end 호출. `pagehide` 에서도 한 번(`keepalive: true` fetch) |
| 호출 지점 3곳 | `recordPlay({ musicId, source: "MAP", playedMs: 0 })` → `recordPlay({ musicId, source: "MAP", layer: useMapStore.getState().layer })`. `layer` 는 항상 넣어도 된다(서 있으면 무시). **+1 하지 않는다** |
| `types/api.ts` `ApiErrorCode` | `"PRESENCE_ERROR"`, `"SERVICE_UNAVAILABLE"` 추가 (`SpecErrorCode` 에 `FORBIDDEN`·`MUSIC_NOT_FOUND` 는 이미 있음) |

> 로컬 `localhost:3000` 에서 rewrite 로 `/api/music/play` 를 치면 `Origin` 이 그대로 전달되어 백엔드 CORS 가 403 을 낼 수 있다(S15P21A405-303 과 동일). 배포는 동일 오리진이라 통과. 로컬 개발용으로 **백엔드 `CORS_ALLOWED_ORIGINS` 에 `http://localhost:3000` 추가**를 지원에게 요청하면 된다(BFF 대리호출로 우회하면 안 된다 — 서버 토큰이 된다).

---

## 4. 뷰포트 — "지도 위 사람" (지금 `useNearbyUsersQuery` 가 하는 일의 대체)

### 4.1 지금 프론트

- `hooks/queries/use-nearby-users-query.ts` → `GET /bff/users/nearby?layer=` 15초 폴링, 목 12명/레이어(`mocks/user.ts`).
- 결과 `NearbyUser[]` 를 `map-view.tsx` 가 `engine.setFriends(layer, friends)` 로 넘기고, 엔진 `anchorFor(u)` 가 `u.musicId` 의 상주 별 자리에 표식을 그린다(`draw-friends.ts`). 상주 집합에 없으면 이메일 해시로 임의 별에 붙인다(목 폴백).
- `friends-panel.tsx`(주변 사람 패널)도 같은 훅을 쓴다 — 이건 §5 로 갈라진다.

### 4.2 백엔드 모델 — 폴링이 아니라 "화면 구독"

화면(뷰포트) 범위를 보내면 서버가 그 안의 사람을 **한 번 스냅샷**으로 주고, 이후 변화는 **델타**로 밀어준다. 화면이 넓으면(셀 36개 초과 또는 사람 20명 초과) 개인 대신 **셀별 인원수**로 준다.

#### 요청 `/app/presence/viewport`

```json
{
  "requestSeq": 7,
  "layer": 2,
  "minX": -2.15, "maxX": 1.80, "minY": -0.90, "maxY": 3.42,
  "ancestorBounds": [
    { "layer": 0, "minX": -5.1, "maxX": 4.2, "minY": -3.3, "maxY": 6.0 },
    { "layer": 1, "minX": -1.0, "maxX": 2.5, "minY": -2.0, "maxY": 1.1 }
  ]
}
```

| 필드 | 값의 출처 (엔진) | 규칙 |
| --- | --- | --- |
| `requestSeq` | 뷰포트 요청 카운터 | 1 이상 단조 증가. 서버는 더 큰 seq 가 이미 오면 이전 요청을 **조용히 버린다**(응답 없음) |
| `layer` | `useMapStore.layer` (= `boxes.length`) | 0~7, 변환 없음 |
| `minX..maxY` | **엔진 `viewBox()` 의 원시 PC 좌표** (화면 네 귀퉁이 `screenToWorld`). 지금 파고들기 때 `drillBox()` 로 쓰는 것과 같은 값 | `min < max`, 유한수 |
| `ancestorBounds` | `useMapStore.boxes` 를 이름만 바꿔 복사: `{layer: b.layer, minX: b.xMin, maxX: b.xMax, minY: b.yMin, maxY: b.yMax}` | **길이 = layer, `bounds[i].layer === i`** 여야 한다(= `boxes[i].layer === i`, 엔진이 이미 보장). 안 맞으면 `PRESENCE_VIEWPORT_INVALID` |

즉 `/api/music/major` 쿼리(`pc{k}min/max`)와 **같은 상자들**이다(그쪽 `level` 만 1-based). `api-endpoints.ts` `map.songs(boxes)` 옆에 `toViewportRequest(boxes, viewBox)` 헬퍼 하나로 만들 수 있다.

```ts
const toViewportRequest = (seq: number, boxes: readonly LayerBox[], view: LayerBox) => ({
  requestSeq: seq,
  layer: boxes.length,
  minX: view.xMin, maxX: view.xMax, minY: view.yMin, maxY: view.yMax,
  ancestorBounds: boxes.map((b) => ({ layer: b.layer, minX: b.xMin, maxX: b.xMax, minY: b.yMin, maxY: b.yMax })),
});
```

**언제 보내나**: 팬·줌·겹 전환이 멎은 뒤 **250ms 디바운스**(`realtime.viewport.debounce-ms`). 엔진 스냅샷(`syncFromEngine`)에 `boxes`·카메라가 이미 올라오므로 `map-view.tsx` 의 `useEffect` 한 개로 처리 가능. 주변 탐색/별자리 뷰처럼 지도가 실제 좌표를 안 보여줄 때는 보내지 않아도 된다(표식도 안 그리므로).

#### 응답 ① `VIEWPORT_SNAPSHOT` — `mode: INDIVIDUAL`

```json
{ "requestSeq": 7, "mode": "INDIVIDUAL", "layer": 2,
  "groups": [
    { "musicId": 8812, "x": 0.37, "y": 1.24,
      "users": [ { "email": "a@x.com", "nickname": "연희", "imageUrl": null, "riderCount": 0 } ] }
  ],
  "resolution": null, "cells": [] }
```

- `groups[]` = 같은 곡 위에 서 있는 사람들. **나는 빠져 있다.**
- `groups[].x, y` 는 **원시 PC 좌표**(요청 `minX..maxY` 와 같은 좌표계) — 엔진 월드 좌표로 그대로 찍는다. 그 곡이 상주 집합에 있으면 `worldOf(musicId)` 와 같은 값이다.
- `requestSeq` 가 내 마지막 요청과 다르면 버린다(늦게 도착한 옛 화면).

#### 응답 ② `VIEWPORT_SNAPSHOT` — `mode: CLUSTERED`

```json
{ "requestSeq": 8, "mode": "CLUSTERED", "layer": 0,
  "groups": [],
  "resolution": 8,
  "cells": [ { "cellX": 2, "cellY": 5, "x": -3.13, "y": 1.02, "count": 14 } ] }
```

- 화면이 넓어(셀 > 36) 또는 사람이 많아(> 20) 개인 표시를 포기한 경우. **셀별 인원수만** 온다. `resolution` 은 한 줄 셀 수(16 → 8 → 4 … 64칸 이하가 될 때까지 2×2 병합).
- `cells[].x, y` 는 **원시 PC 좌표**(셀 중심, 화면 범위로 클램프). 그대로 `worldToScreen` 에 넣으면 된다. 그 자리에 "N명" 뭉치 표식.
- 이 모드일 땐 개인 델타가 오지 않고, 대신 **5초마다 `VIEWPORT_CELL_COUNTS`** 가 온다:

```json
{ "type": "VIEWPORT_CELL_COUNTS", "payload": { "requestSeq": 8, "layer": 0, "resolution": 8, "cells": [ ... ] } }
```
→ `cells` 를 통째로 교체.

#### 응답 ③ 델타 (`INDIVIDUAL` 일 때만) — `VIEWPORT_ENTER` · `VIEWPORT_MOVE` · `VIEWPORT_LEAVE`

```json
{ "requestSeq": 7, "email": "a@x.com", "nickname": "연희", "imageUrl": null,
  "musicId": 9001, "x": 2.05, "y": -0.71, "riderCount": 0 }
```

| 타입 | 뜻 | 처리 |
| --- | --- | --- |
| `VIEWPORT_ENTER` | 화면 안으로 들어옴(다른 곳에서 이동·새 접속) | 목록에 추가 |
| `VIEWPORT_MOVE` | 화면 안에서 다른 곡으로 이동 | 그 사람 `musicId/x/y` 갱신 → 엔진의 우주선 이동 연출(`FollowState.mv` 같은 것) |
| `VIEWPORT_LEAVE` | 화면 밖으로 나감·접속 종료 | `email` 만 유효, 나머지 null. 목록에서 제거 |

`requestSeq` 가 현재 것이 아니면 버린다. `x,y` 는 스냅샷과 같이 **원시 PC**.

#### 닫기 `/app/presence/viewport/close`

```json
{ "requestSeq": 8 }
```
지도가 사라질 때(언마운트, 다른 화면으로 이동). 안 보내도 DISCONNECT·새 viewport 요청이 이전 구독을 덮는다.

### 4.3 `NearbyUser` 타입과의 대응

| FE `NearbyUser` 필드 | 서버가 주는가 | 처리 |
| --- | --- | --- |
| `email`, `nickname`, `imageUrl`, `musicId`, `riderCount` | O (`ViewportUser` + `group.musicId`) | 그대로 |
| `isOnline` | X | 뷰포트에 있다 = 접속 중. **항상 `true`** |
| `isPublic` | X | 비공개 계정은 미구현. `true` 고정 |
| `viewingMusicId` | X (따라가기 미구현) | `musicId` 와 같게 |
| `genreId` | X | 상주 집합에서 `musicId` 로 찾으면 그 곡의 `genreId`, 없으면 `NO_GENRE_ID` |
| `meetingCount` | X (뷰포트에는 없음, 주변 사람 패널에는 있음 §5) | `0` |
| `followingNickname` | X (따라가기 미구현) | `null` |
| `avatarSeed` | X (FE 전용) | 이메일 해시로 생성(지금 목이 하는 방식) |

`viewingMusicId·followingNickname·isPublic` 은 따라가기·비공개계정 스펙이 붙을 때 채워진다. 지금은 `NearbyUser` 에서 optional 로 바꾸거나 위 기본값으로 채운다.

### 4.4 좌표 — 전부 원시 PC (변환 없음)

실시간에서 오가는 모든 `x`·`y` 는 엔진 월드 좌표(원시 PC 값)다.

| 어디 | 좌표계 |
| --- | --- |
| 요청 `minX..maxY`, `ancestorBounds` | 원시 PC (엔진 `viewBox()`·`boxes`) |
| 응답 `groups[].x,y`(INDIVIDUAL), 델타 `x,y`, `cells[].x,y`(CLUSTERED), `PlayResponse.x,y` | 원시 PC — `worldToScreen` 에 그대로 |

개인 표식은 `musicId` 가 상주 집합에 있으면 그 별 자리(`worldOf`)에, 없으면(그 겹 상주 1000곡 밖의 곡) 응답 `x,y` 에 그린다. 두 값은 같은 좌표계라 섞어 써도 된다. 지금 엔진의 `anchorFor` 이메일 해시 폴백은 필요 없어진다.

### 4.5 프론트 수정

| 파일 | 수정 |
| --- | --- |
| 새 `lib/realtime/stomp-client.ts` (또는 `stores/use-realtime-store.ts`) | §1 연결·구독·봉투 파싱·seq 검사·heartbeat·재연결 시 join/viewport 재전송. 앱 전체에 하나 |
| 새 `hooks/use-presence-join.ts` | `layer` 변경을 보고 `/app/presence/join` 전송, `PRESENCE_JOINED` 로 `myMusicId` 동기화, `PRESENCE_NO_ANCHOR` 는 "아직 재생 전" 상태로 |
| 새 `hooks/use-viewport-subscription.ts` | 엔진 `boxes`+`viewBox` → 250ms 디바운스 → viewport 전송. 스냅샷/델타/셀카운트를 `NearbyUser[]` 또는 `cells[]` 상태로 유지 |
| `components/map/map-view.tsx` | `useNearbyUsersQuery(layer)` → 위 훅으로 교체. `engine.setFriends(layer, friends)` 는 그대로. CLUSTERED 면 `engine.setClusters(cells)` 같은 새 입력 |
| `components/map/engine/map-engine.ts` | `viewBox()` 를 public 으로(요청 범위 산출), 셀 뭉치 그리기 추가, `anchorFor` 의 해시 폴백 제거 → 응답 `x,y` 로 |
| `components/map/render/draw-friends.ts` | 그대로 사용 가능(`NearbyUser` 만 채우면). 셀 뭉치("N명") 렌더 추가 |
| `hooks/queries/use-nearby-users-query.ts`, `app/bff/users/nearby/route.ts`, `mocks/user.ts` `mockNearbyUsers` | 목 스위치(`USE_MOCK_API`) 일 때만 남기고 실연동에서는 제거 |
| `hooks/use-mock-friend-reactions.ts` | 반응은 범위 밖 — 실연동에서는 끈다 |

---

## 5. 주변 사람 패널 (`friends-panel.tsx`) — 내 곡과 비슷한 곡을 듣는 사람

뷰포트("화면 안")와 다른 기준이다: **내가 듣는 곡의 이웃 곡(10곡)을 듣는 사람**, 가까운 순. 좌표는 없다(목록 전용).

### 5.1 열기 — `POST /api/realtime/nearby` (본문 없음)

```json
{ "success": true, "data": {
  "anchorMusicId": 8812, "snapshotSeq": 41,
  "people": [
    { "email": "a@x.com", "nickname": "연희", "imageUrl": null,
      "meetingCount": 3, "riderCount": 0,
      "musicId": 8812, "title": "…", "artist": "…", "distance": 0.0 },
    { "email": "b@x.com", "nickname": null, "imageUrl": null,
      "meetingCount": 0, "riderCount": 2,
      "musicId": 9001, "title": "…", "artist": "…", "distance": 1.83 }
  ] }, "error": null }
```

| 필드 | 뜻 |
| --- | --- |
| `anchorMusicId` | 기준이 된 내 곡 |
| `snapshotSeq` | 이 목록이 반영한 마지막 WS `seq`. **이 값 이하의 `NEARBY_*` 델타는 이미 목록에 있으니 버린다** |
| `people[]` | 평면 목록, 가까운 순. 나는 없다. `nickname` null 가능. `distance` 는 내 곡과 그 사람 곡의 16차원 거리(정렬용) |

오류: 422 `PRESENCE_ERROR`(아직 재생한 곡이 없다 / 접속 아님) · 404 `MUSIC_NOT_FOUND` · 503 `SERVICE_UNAVAILABLE`(이웃곡 계산 실패 — 잠시 후 재시도 안내).

호출하면 **동시에 실시간 구독이 시작**된다(그래서 POST 다). 패널을 열 때 한 번만 부른다 — 폴링 금지.

### 5.2 델타 (`/user/queue/presence`)

```json
{ "email": "c@x.com", "nickname": "도현", "imageUrl": null, "meetingCount": 1, "riderCount": 0, "musicId": 9004 }
```

| 타입 | 처리 |
| --- | --- |
| `NEARBY_ENTER` | 목록에 추가. `musicId` 로 정렬 위치 — `people` 에 이미 있는 곡이면 그 곡 옆, 아니면 맨 뒤(distance 는 오지 않는다) |
| `NEARBY_MOVE` | 그 사람의 `musicId` 갱신 |
| `NEARBY_LEAVE` | `email` 만 유효. 제거 |
| `NEARBY_SNAPSHOT` | **내 곡이 바뀌었을 때** 서버가 목록을 통째로 다시 보낸다(payload = §5.1 `data` 와 같은 모양). 통째로 교체 |

봉투 `seq ≤ snapshotSeq` 면 버린다.

### 5.3 닫기 — `/app/nearby/close` (본문 없음)

패널을 닫을 때 보낸다. 안 보내면 델타가 계속 온다(패널이 닫혔는데 상태만 바뀌는 낭비).

### 5.4 프론트 수정

| 파일 | 수정 |
| --- | --- |
| `constants/api-endpoints.ts` | `realtime.nearby: "/api/realtime/nearby"` |
| 새 `hooks/queries/use-nearby-people-query.ts` | `useQuery` 로 POST 한 번(`staleTime: Infinity`, `refetchInterval` 없음). `enabled: 패널 열림 && features.social && 소켓 연결됨` |
| 새 `hooks/use-nearby-people-live.ts` | `NEARBY_*` 를 받아 캐시(`queryClient.setQueryData`) 갱신, `snapshotSeq` 필터. 패널 닫힘에 `/app/nearby/close` |
| `components/panels/friends/friends-panel.tsx` | `useNearbyUsersQuery(layer)` → 위 훅. `layer` 인자는 없어진다(레이어 무관) |
| `components/panels/friends/friend-row.tsx` | `user.isOnline` → 항상 true, `followingNickname` → 없음. "따라가기" 버튼은 `FEATURES` 로 감춘다(따라가기 백엔드 미구현) |
| `types` | `NearbyPerson` 타입 추가 (`NearbyUser` 와 다르다: `title/artist/distance/meetingCount` 있음, 좌표 없음) |

---

## 6. 오류 코드 한 장

### 6.1 WS — `/user/queue/errors`, 타입 `PRESENCE_ERROR`

```json
{ "type": "PRESENCE_ERROR", "seq": 5, "ts": 0,
  "payload": { "code": "PRESENCE_NO_ANCHOR", "message": "재생 기록이 없어 입장할 수 없다. 먼저 곡을 재생해야 한다", "requestSeq": 1 } }
```

| `code` | 언제 | 프론트 처리 |
| --- | --- | --- |
| `PRESENCE_NO_ANCHOR` | 첫 join, 재생 기록 없음 | **정상 흐름.** 표식 없이 지도 표시, 첫 재생에 `layer` 넣기 (§2.2) |
| `PRESENCE_NOT_CONNECTED` | 세션 등록 전에 요청 / 서버 재시작 | 잠시 후 재전송, 반복되면 재연결 |
| `PRESENCE_STALE` | 이전 탭·만료된 접속·heartbeat 늦음·resync | 재연결 후 join·viewport 재전송. 다른 탭이 조종 중이면 안내 |
| `PRESENCE_LAYER_INVALID` | layer 가 0~7 밖 | 코드 버그(예: 예전 습관으로 +1 해서 8 을 보냄) |
| `PRESENCE_JOIN_INVALID` | requestSeq/musicId ≤ 0, 본문 없음 | 코드 버그 |
| `PRESENCE_VIEWPORT_INVALID` | min≥max, ancestorBounds 길이/순서 불일치, 본문 없음 | 코드 버그 — §4.2 규칙 확인 |
| `PRESENCE_LOCATION_NULL` | 서버에 곡 좌표 없음 | 드묾. 토스트 후 다른 곡 재생 유도 |

`requestSeq` 는 join·viewport 오류에만 붙는다.

### 6.2 REST — `{success:false, error:{code,message}}` (기존 `api.ts` 가 `ApiError` 로 던진다)

| HTTP | `code` | 어디서 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | play(`source` 오타·`musicId` 없음·`layer` 범위 밖), end(`playedMs` 음수) |
| 403 | `FORBIDDEN` | end — 내 기록 아님/없는 ID |
| 404 | `MUSIC_NOT_FOUND` | play·nearby — 곡 없음 |
| 422 | `PRESENCE_ERROR` | play·nearby — 소켓 미연결, 첫 배치인데 layer 없음, 곡 좌표 없음, 재생 곡 없음(nearby) |
| 503 | `SERVICE_UNAVAILABLE` | nearby — 이웃곡 계산 실패 |

---

## 7. 전체 시퀀스 (한 세션)

```
[로그인 완료, accessToken 보유]
1. WS CONNECT /ws/websocket  (Authorization: Bearer …)
2. SUBSCRIBE /user/queue/presence, /user/queue/errors
3. SEND /app/presence/join {requestSeq:1, layer:0, musicId:<저장된 곡 or 1>}
   ← PRESENCE_JOINED {requestSeq:1, layer:0, musicId:8812}        → 내 표식 = 8812
   (또는 ← PRESENCE_ERROR PRESENCE_NO_ANCHOR                      → 표식 없음, 첫 재생 대기)
4. 15초마다 SEND /app/presence/heartbeat
5. 지도 정지 250ms → SEND /app/presence/viewport {requestSeq:1, layer:0, minX.., ancestorBounds:[]}
   ← VIEWPORT_SNAPSHOT (INDIVIDUAL | CLUSTERED)
   ← VIEWPORT_ENTER/MOVE/LEAVE …  또는 5초마다 VIEWPORT_CELL_COUNTS
6. 곡 재생 → POST /api/music/play {musicId:9001, source:"MAP", layer:0}
   ← {playHistoryId:501, musicId:9001, layer:0, x, y, …}          → 내 표식 9001 로 비행
   (다른 사람들 화면에는 서버가 VIEWPORT_MOVE 를 보낸다)
7. 곡 끝/다음 곡 → PATCH /api/music/play/end {playHistoryId:501, playedMs:183000}
8. 파고들기(레이어 0→1) → SEND /app/presence/join {requestSeq:2, layer:1, musicId:9001}
   ← PRESENCE_JOINED {layer:1, musicId:9001}
   → 새 화면 viewport {requestSeq:2, layer:1, ancestorBounds:[{layer:0,…}]}
9. 주변 사람 패널 열기 → POST /api/realtime/nearby   ← {snapshotSeq, people[]}
   ← NEARBY_ENTER/MOVE/LEAVE …, 내 곡 바뀌면 NEARBY_SNAPSHOT
   패널 닫기 → SEND /app/nearby/close
10. 탭 닫기 → SEND /app/presence/leave (선택) → DISCONNECT
```

---

## 8. 백엔드·인프라에 요청할 것 (FE 가 막히는 지점)

| 담당 | 항목 | 상태 |
| --- | --- | --- |
| 인프라 | nginx `/ws` location + `Upgrade`/`Connection: upgrade` 헤더, 타임아웃 ≥ 60s | 요청 필요 |
| 인프라/BE | 배포 `spring.profiles.active` 에 `realtime` 포함, Redis 연결 | 확인 필요 |
| BE1 | `CORS_ALLOWED_ORIGINS` 에 `http://localhost:3000` (로컬 개발) | 요청 필요 |
| BE3(지원) | `SecurityConfig.anyRequest().permitAll()` → `authenticated()` 원복 (`/api/music/play*`, `/api/realtime/**`) | 원복 예정 |
| BE3(지원) | 뷰포트 `groups/델타/PlayResponse x,y` 원시 좌표 통일 | **완료** (2026-09-18) |
| BE3(지원) | 실시간 계약 `layer` 0-based 전환 (join·viewport·play·응답) | **완료** (2026-09-18) |
| BE3(지원) | 따라가기·반응·비공개계정 | 이번 범위 밖 |

---

## 9. 프론트 수정 파일 총정리

| 구분 | 파일 | 무엇을 |
| --- | --- | --- |
| 의존성 | `package.json` | `@stomp/stompjs` 추가 |
| 환경 | `.env.example` | `NEXT_PUBLIC_WS_ORIGIN` (비면 현재 오리진) |
| 상수 | `constants/api-endpoints.ts` | `music.play` → `/api/music/play`, `music.playEnd`, `realtime.nearby` |
| 상수 | `constants/live-api-paths.ts` | 위 3경로 추가 + 실로그인 경로 주석 해제 (§0.2) |
| 상수 | 새 `constants/realtime.ts` | destinations(`/app/presence/join` …), 큐 2개, heartbeat 15000, debounce 250 |
| 타입 | `types/api.ts` | `PRESENCE_ERROR`, `SERVICE_UNAVAILABLE` |
| 타입 | 새 `types/realtime.ts` | `RealtimeMessage<T>`, `PresenceJoined`, `ViewportRequest/Snapshot/Delta/CellCounts`, `NearbySnapshot/Person/Change`, `PlayResponse`, `WebSocketErrorCode` |
| 통신 | 새 `lib/realtime/stomp-client.ts` | 연결·구독·봉투·seq·heartbeat·재연결 복원 |
| 훅 | 새 `hooks/use-presence-join.ts` | join / PRESENCE_JOINED / NO_ANCHOR |
| 훅 | 새 `hooks/use-viewport-subscription.ts` | viewport 요청·스냅샷·델타·셀카운트·close |
| 훅 | `hooks/mutations/use-record-play-mutation.ts` | 본문·경로·응답 변경, `playHistoryId` 보관 |
| 훅 | 새 `hooks/mutations/use-play-end-mutation.ts` | play/end |
| 훅 | 새 `hooks/queries/use-nearby-people-query.ts`, `hooks/use-nearby-people-live.ts` | 주변 사람 패널 |
| 스토어 | `stores/use-player-store.ts` | `playHistoryId`, 종료 시 end 전송 |
| 지도 | `components/map/map-view.tsx` | 폴링 훅 → 뷰포트 훅, 재생 호출에 `layer` (0-based 그대로) |
| 지도 | `components/map/engine/map-engine.ts` | `viewBox()` 공개, 셀 뭉치 입력, 해시 폴백 제거 |
| 지도 | `components/map/render/draw-friends.ts` | 셀 뭉치 렌더 |
| 패널 | `components/panels/friends/friends-panel.tsx`, `friend-row.tsx` | 주변 사람 실연동, 따라가기 버튼 가림 |
| 제거/목 전용 | `hooks/queries/use-nearby-users-query.ts`, `app/bff/users/nearby/route.ts`, `mocks/user.ts`, `hooks/use-mock-friend-reactions.ts` | `USE_MOCK_API=1` 에서만 |
