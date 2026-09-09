# 백엔드·ERD 영향 목록 (Frontend → Backend)

프론트 구현 과정에서 나온 **백엔드·ERD 협의 항목**을 모은 문서다.
프론트가 임의로 정할 수 없는 것들이며, 목(mock) API로 임시 구현해둔 것도 전부 여기에 적는다.

- 상태: `협의 전` / `협의 중` / `반영됨`
- 최종 수정: 2026-09-09

**항목을 추가했으면 문서만 고치고 끝내지 말고 백엔드에 직접 알린다** ([루트 CLAUDE.md §3](../../CLAUDE.md)).
반대로 백엔드가 API·응답·에러 코드를 바꿨으면 여기와 [FEATURES.md](FEATURES.md)를 갱신하고 프론트에 알린다.

---

## 0. 배포된 백엔드와 대조한 결과 (2026-09-09)

`backend/src/main/java/com/ssafy/backend/` 를 직접 읽고 확인한 것. **문서보다 코드가 최신이다.**

| # | 항목 | 확인된 사실 | 프론트 조치 | 상태 |
| --- | --- | --- | --- | --- |
| B-6 | 공통 응답 봉투 | `ApiResponse<T>(boolean success, T data, ErrorResponse error)` — API 명세서 §0.2와 일치 | `src/lib/api.ts` 가 벗겨서 `data` 반환 | 반영됨 |
| B-7 | `POST /api/auth/exchange` | body `{code}` → `data: {accessToken}` | `use-exchange-code-mutation.ts` | 반영됨 |
| B-8 | `POST /api/auth/reissue` | **존재함.** refresh 쿠키로 새 accessToken 재발급 | 401 시 1회 재발급 후 재시도 로직 필요 | 협의 전 |
| B-9 | `POST /api/auth/withdraw` | **존재함.** 회원 탈퇴 (USER-01) | 프론트 화면 미구현 | 협의 전 |
| B-10 | **에러 코드가 API 명세서 §0.5와 다름** | 구현: `UNAUTHENTICATED` `INVALID_TOKEN` `REFRESH_TOKEN_NOT_FOUND` `REFRESH_TOKEN_MISMATCH` `INVALID_EXCHANGE_CODE` `INVALID_INPUT` `INTERNAL_SERVER_ERROR` / 명세서: `VALIDATION_ERROR` `TOKEN_EXPIRED` `REFRESH_TOKEN_INVALID` `OAUTH_FAILED` `INTERNAL_ERROR` … | **어느 쪽이 맞는지 백엔드 확인 필요.** 확정 전까지 `src/types/api.ts` 는 양쪽을 모두 허용 | 협의 전 |
| B-11 | OAuth 리다이렉트 URI | `app.oauth.frontend-redirect-uri` 설정값으로 이동. 교환 코드는 1회용, TTL 30초 | 프론트 착지점은 `/oauth/redirect`. **이 값이 그렇게 설정돼 있는지 백엔드 확인 필요** | 협의 전 |
| B-12 | 인증 외 API 전무 | 컨트롤러가 `Auth` / `Hello` / `Test` / `WebSocketTest` 뿐 | 지도·검색·플리·여정·소셜·차트는 계속 목 라우트로 개발 | — |

---

## 1. ERD 변경 필요

| # | 대상 | 필요한 변경 | 이유 | 없으면 안 되는 것 | 상태 |
| --- | --- | --- | --- | --- | --- |
| E-1 | `user` | `tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE` 추가 | 온보딩 튜토리얼 완료 여부 (AUTH-04) | 재접속마다 튜토리얼이 다시 뜬다 | 반영됨 (2026-09-08 ERD 반영) |
| E-2 | `music.location` | `VECTOR(16)`을 **PC1~PC16 값 그대로** 내려줄 것. 표준화(z-score) 기준을 백엔드와 통일 | 클라이언트가 레이어별로 재투영한다. 레이어 l 은 `pc[2l], pc[2l+1]`을 축으로 씀 | 파고들기·별자리·주변 탐색 전부 불가 | 협의 전 |
| E-3 | `music` | `pc1`, `pc2` 를 인덱스용 스칼라 컬럼으로 분리 검토 | 레이어 0 뷰포트 스트리밍에 bbox 쿼리가 필요 | 900만곡 레이어 0 조회 성능 | 협의 전 |
| E-4 | `playlist.like_cnt` | `NULL` 허용 → `NOT NULL DEFAULT 0` 검토 | 다른 카운트(`play_cnt`, `youtube_cnt`)는 이미 DEFAULT 0 인데 이것만 NULL 허용 | 프론트에서 매번 `?? 0` 처리 | 협의 전 |
| E-5 | `music` | 곡 상세에 필요한 필드가 ERD에 없음: 앨범 커버 URL, 발매 국가, 언어, 작곡가, 작사가, 무드 태그 | 곡 상세 패널 구성 항목 (SONG-02, 유저 플로우) | 상세 화면의 절반이 빈칸 | 협의 전 (타입에 optional 로 둠) |

---

## 2. 신규 API / 응답 변경

| # | API | 요청 | 응답 | 이유 | 상태 |
| --- | --- | --- | --- | --- | --- |
| A-1 | `GET /api/map/songs` | 없음 (또는 뷰포트·게이트 파라미터) | `MapPoint[]` = `{ musicId, pc[16], genreId, weight, title, artist, playable }` | 지도 렌더링·재투영의 원본. 실서비스는 레이어 0 스트리밍 + 게이트 이하 상주 집합 통째 전송 | 협의 전 |
| A-2 | `GET /api/map/layers/{layer}/representatives` | layer | `{ layer, musicIds[] }` | 레이어마다 **다른 대표곡**을 앨범 커버로 띄운다. 선별 기준은 백엔드가 정함 | 협의 전 |
| A-3 | `GET /api/users/nearby?layer={n}` | layer | `NearbyUser[]` | 지금 있는 **영역(레이어)의 사용자만** 내려줘야 한다. 레이어마다 다른 사람이 보임 (SOCIAL-01) | 협의 전 |
| A-4 | `NearbyUser` 응답 | — | `viewingMusicId` **추가 필요** | 따라가기 시 좌표 두 개가 필요하다: `musicId`=재생 중(우주선 위치), `viewingMusicId`=인솔자가 보고 있는 상세 곡(뷰포트·우측 패널 기준) (SOCIAL-07) | 협의 전 |
| A-5 | `GET /api/journeys/route?start=&end=` | 두 곡 ID | `JourneyRoute` (정거장 약 20곡) | **16차원 임베딩 거리 기준**으로 경로를 뽑아야 한다. 2D 평면 직선으로 뽑으면 레이어 0에서 일직선이 되어 별자리 모양이 안 나온다 (PATH-01) | 협의 전 |
| A-6 | `GET /api/map/nearby/{musicId}` | musicId | `{ center, neighbors[10] }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10) | 협의 전 |
| A-8 | `GET /api/music/{id}/representative-layers` | musicId | `{ musicId, layers: number[] }` (오름차순) | 검색 결과를 누르면 그 곡이 **대표곡으로 노출되는 첫 레이어**로 이동해야 한다. 한 곡이 여러 레이어에서 대표곡일 수 있다. 클라이언트가 8개 레이어 대표곡을 전부 들고 있을 수 없으므로 서버가 계산해야 한다 (SEARCH-01) | 협의 전 |
| A-7 | `POST /api/music/{id}/play` | `{ source, playedMs }` | ok | 재생 로그 (`play_history`). `source` 값은 `MAP` / `JOURNEY` / `PLAYLIST` / `FOLLOW` | 협의 전 |

---

## 3. 백엔드 계산·전송 전제

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| B-1 | **상주 집합 전송**: 레이어 0은 뷰포트 스트리밍, 화면 안 곡이 게이트(약 5만곡) 이하로 좁혀지면 그 집합을 PC 16개 포함해 통째로 내려준다 (약 2.8MB) | 클라이언트가 재투영·모프를 하려면 PC 값을 들고 있어야 한다 | 협의 전 |
| B-2 | **레이어별 대표곡 선별 기준** (재생수? 밀도? 클러스터 중심?) | 레이어마다 다른 곡이 커버로 떠야 한다 | 협의 전 |
| B-3 | **축 라벨**: 레이어별 두 축의 일상어 라벨을 데이터 확정 후 내려줄 것 (MAP-06) | 지금은 프론트 임시값(`LAYER_AXES`) | 협의 전 |
| B-4 | **레이어 수 8개 / 대표곡 1000개** 전제 확인 | 프론트 상수(`LAYER_COUNT`, `REPRESENTATIVES_PER_LAYER`)가 이 값에 묶여 있다 | 협의 전 |

---

## 4. 실시간(소켓) 필요 항목

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| S-1 | 따라가기 동기화 — 인솔자의 동작을 **세 종류 이벤트로 따로** 보내야 한다 (SOCIAL-07): ① `leader:view` = 곡 클릭(`viewingMusicId`) ② `leader:play` = 재생 시작(`playingMusicId`) ③ `leader:layer` = 레이어 전환(`layer`) | 뷰는 ①에서 먼저 움직이고, 우주선은 ②가 와야 출발한다. 두 개를 한 이벤트로 합쳐 보내면 이 연출이 불가능하다 | 협의 전 |
| S-2 | 따라가기 자동 종료: 인솔자 접속 종료·비공개 전환 시 (SOCIAL-10-1) | 서버가 알려줘야 한다 | 협의 전 |
| S-3 | 접속 상태·현재 탐색 좌표 실시간 관리 (USER-03) | 주변 사람 목록의 실시간성 | 협의 전 |
| S-4 | 반응 전송·수신 (SOCIAL-02, SOCIAL-04 쿨다운) | 같은 영역 사용자에게 즉시 전달 | 협의 전 |
| S-5 | 따라가는 인원 수 (SOCIAL-11), 만난 횟수 카운팅 (SOCIAL-05) | 서버 집계 필요 | 협의 전 |
