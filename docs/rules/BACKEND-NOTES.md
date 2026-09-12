# 백엔드·ERD 영향 목록 (Frontend → Backend)

프론트 구현 과정에서 나온 **백엔드·ERD 협의 항목**을 모은 문서다.
프론트가 임의로 정할 수 없는 것들이며, 목(mock) API로 임시 구현해둔 것도 전부 여기에 적는다.

- 상태: `협의 전` / `협의 중` / `반영됨`
- 최종 수정: 2026-09-11

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
| B-13 | 인증 관련 에러 코드 | **구현됨** (backend/dev `AuthErrorCode`): `EMAIL_ALREADY_EXISTS` `NICKNAME_ALREADY_EXISTS` `INVALID_CREDENTIALS` `PASSWORD_MISMATCH` `INVALID_PASSWORD_FORMAT`(영문+숫자 8~72자) `INVALID_NICKNAME_LENGTH`(2~20자) | 프론트 `ImplementedErrorCode` 에 반영 완료. 목 라우트도 같은 코드로 답한다 | 반영됨 |
| B-14 | **구글 로그인 본안은 idToken 방식** | 배포 브랜치(`backend/jenkins`)에 `POST /api/auth/login/google` 이 있다 — `{idToken}` 을 받아 `GoogleIdTokenVerifierAdapter` 가 검증하고 `{accessToken, user{email,name,nickname,imageUrl}}` + refresh 쿠키를 준다. 주석에 "AUTH-01 본안"으로 명시. 리다이렉트 방식(`/oauth2/authorization/google` → `?code=` → `/exchange`)도 함께 살아 있다 | 프론트를 idToken 방식으로 붙였다 (S15P21A405-129). 응답에 `user` 가 오므로 A-15 없이도 신규 여부를 판단한다. 리다이렉트 방식 착지 페이지·목 exchange 라우트는 삭제 | 반영됨 |
| B-16 | **`backend/dev` 와 배포본(`backend/jenkins`)이 다르다** | 배포본은 패키지가 `auth/` `music/` `user/` 로 재구성돼 있고 `/api/auth/login/google`, `/api/user/tutorial-completed`, `/api/users/nickname-available` 가 있다. `backend/dev` 에는 `/api/auth/login/google` 이 없다. SecurityConfig 도 다르다 — 배포본은 `anyRequest().authenticated()` 기본 거부 | 프론트는 **배포본 기준**으로 붙였다. `backend/dev` 로 로컬 백엔드를 띄우면 구글 로그인이 404 난다 — 어느 쪽이 기준인지 백엔드 확인 필요 | 협의 전 (**필요**) |
| B-17 | CORS 가 로컬 오리진을 막는다 | 배포 백엔드에 `Origin: http://localhost:3000`(3001·5173 도 동일) 로 preflight 하면 **403, `Access-Control-Allow-Origin` 없음**. `app.cors.allowed-origins` 에 로컬이 없다 | 로컬 dev 서버에서 배포 백엔드로 구글 로그인 요청이 브라우저에 막힌다. 로컬 오리진 추가 필요 | 협의 전 (**필요**) |
| B-15 | 배포 서버 응답 | 실제 도메인은 `https://j15a405.p.ssafy.io` — `.env.example` 에 있던 `j15a405a` 는 오타였다. 2026-09-10 확인: `/oauth2/authorization/google` → 구글 동의 화면으로 302 (client_id·PKCE 정상), 콜백 `/login/oauth2/code/google` 도 백엔드로 라우팅됨. `/api/auth/google` 은 401, `/api/health` 는 백엔드에 없어 401 | 백엔드 OAuth 진입은 살아 있다. 프론트 버튼을 실제 경로로 연결하고(S15P21A405-129) 로컬 dev + 배포 백엔드로 구글 로그인 화면까지 도달 확인 | 반영됨 |
| B-10 | **에러 코드가 API 명세서 §0.5와 다름** | 구현: `UNAUTHENTICATED` `INVALID_TOKEN` `REFRESH_TOKEN_NOT_FOUND` `REFRESH_TOKEN_MISMATCH` `INVALID_EXCHANGE_CODE` `INVALID_INPUT` `INTERNAL_SERVER_ERROR` / 명세서: `VALIDATION_ERROR` `TOKEN_EXPIRED` `REFRESH_TOKEN_INVALID` `OAUTH_FAILED` `INTERNAL_ERROR` … | **어느 쪽이 맞는지 백엔드 확인 필요.** 확정 전까지 `src/types/api.ts` 는 양쪽을 모두 허용 | 협의 전 |
| B-11 | OAuth 리다이렉트 URI | `app.oauth.frontend-redirect-uri` 설정값으로 이동. 교환 코드는 1회용, TTL 30초 | 프론트 착지점은 `/oauth/redirect`. **운영값이 `https://j15a405.p.ssafy.io/oauth/redirect` 인지 백엔드 확인 필요.** 값이 하나뿐이라 로컬 dev 서버에서는 구글 로그인 성공 후 배포 프론트로 착지한다 — 로컬에서 흐름을 끝까지 보려면 로컬 오리진을 받는 방법(프로필 분리 등)이 필요하다 | 협의 전 |
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
| E-6 | `user` | `nickname` 에 **UNIQUE 제약 + NOT NULL**. 길이 2~20자 검증 | 가입 직후 닉네임을 직접 받고 **중복을 허용하지 않는다** (AUTH-01, 2026-09-10 기획 확정). 지금은 `VARCHAR(100) NULL` 로 중복이 들어간다 | 같은 닉네임이 여러 개 생겨 프로필·따라가기에서 사람을 구분할 수 없다 | 협의 전 |
| E-7 | `user` | 비밀번호 해시 컬럼 추가(예: `password_hash VARCHAR(255) NULL`) + **PK 정책 재검토** | 이메일·비밀번호 가입이 확정됐다 (AUTH-01). 현재 PK 는 "구글 계정 이메일"이라 소셜 가입만 전제한다 | 이메일 가입 자체가 불가능 | 협의 전 |

---

## 2. 신규 API / 응답 변경

| # | API | 요청 | 응답 | 이유 | 상태 |
| --- | --- | --- | --- | --- | --- |
| A-1 | `GET /music/major` (목: `/api/map/songs`) | `level` (1-based) + 누적 범위 `pc{k}min`·`pc{k}max` 를 **level-1 쌍 전부**. level=1 은 파라미터 없음 | `MapPoint[]` = `{ musicId, pc[16], genreId, weight, title, artist, playable }` | **겹마다 그 겹의 상주 집합을 받는다** (2026-09-11 BE 김효정 ↔ FE 윤주하 확정, D15~D19). 프론트가 파고들 때 화면 범위를 누적에 쌓고 떠오르면 버린다 — 서버는 탐색 상태를 갖지 않는다. 레이어 l ↔ level l+1, 평면은 pc(2l+1)·pc(2l+2) | 협의 중 (프론트 반영 완료) |
| A-1-1 | `MapPoint.genreId` | — | 장르를 모르는 곡은 **무장르 인덱스(10)** 로 내려준다. 음수 금지 | 실데이터는 662만 중 6.6만(1.0%)만 장르가 있다. 0 으로 채우면 지도가 전부 "앰비언트" 색이 된다. 프론트에 `GENRE_NAMES[10] = "무장르"` 와 회청색을 추가했다. 멜론 코드 29종 → 10색 대응표는 아직 없다 — **누가 어떻게 매핑할지 미정** | 협의 중 (프론트 반영 완료) |
| A-2 | `GET /api/map/layers/{layer}/representatives` | layer | `{ layer, musicIds[] }` | 레이어마다 **다른 대표곡**을 앨범 커버로 띄운다. 선별 기준은 백엔드가 정함 | 협의 전 |
| A-3 | `GET /api/users/nearby?layer={n}` | layer | `NearbyUser[]` | 지금 있는 **영역(레이어)의 사용자만** 내려줘야 한다. 레이어마다 다른 사람이 보임 (SOCIAL-01) | 협의 전 |
| A-4 | `NearbyUser` 응답 | — | `viewingMusicId` **추가 필요** | 따라가기 시 좌표 두 개가 필요하다: `musicId`=재생 중(우주선 위치), `viewingMusicId`=인솔자가 보고 있는 상세 곡(뷰포트·우측 패널 기준) (SOCIAL-07) | 협의 전 |
| A-5 | `GET /api/journeys/route?start=&end=` | 두 곡 ID | `JourneyRoute` (정거장 약 20곡) | **16차원 임베딩 거리 기준**으로 경로를 뽑아야 한다. 2D 평면 직선으로 뽑으면 레이어 0에서 일직선이 되어 별자리 모양이 안 나온다 (PATH-01) | 협의 전 |
| A-6 | `GET /api/map/nearby/{musicId}` | musicId | `{ center, neighbors[10] }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10) | 협의 전 |
| A-8 | `GET /api/music/{id}/representative-layers` | musicId | `{ musicId, layers: number[] }` (오름차순) | 검색 결과를 누르면 그 곡이 **대표곡으로 노출되는 첫 레이어**로 이동해야 한다. 한 곡이 여러 레이어에서 대표곡일 수 있다. 클라이언트가 8개 레이어 대표곡을 전부 들고 있을 수 없으므로 서버가 계산해야 한다 (SEARCH-01) | 협의 전 |
| A-7 | `POST /api/music/{id}/play` | `{ source, playedMs }` | ok | 재생 로그 (`play_history`). `source` 값은 `MAP` / `JOURNEY` / `PLAYLIST` / `FOLLOW` | 협의 전 |
| A-10 | `POST /api/auth/signup` | `{ email, password, nickname }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 가입 (AUTH-01) | ✅ 구현됨 (backend/dev, S15P21A405-121) · 프론트 반영 완료 |
| A-11 | `POST /api/auth/login` | `{ email, password }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 로그인 (AUTH-02) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-12 | `GET /api/users/nickname-available?nickname=` | nickname | `{ available }` | 닉네임 중복 확인 (AUTH-01) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-13 | `PATCH /api/auth/nickname` (경로 협의 필요) | `{ nickname }` | `{ nickname }` | **구글 신규 사용자의 닉네임 저장.** `CustomOAuth2UserService` 가 신규 구글 사용자의 nickname 을 의도적으로 비워두는데, 그 값을 채울 엔드포인트가 없다. `UserController` 에는 `GET /user/detail` 뿐이다. 프론트는 이 API 를 목으로 대체해 두었다 | 협의 전 (**필요**) |
| A-14 | 신규 가입 여부 판단 | — | 본인 조회 응답의 `nickname` 이 null 이면 신규로 본다 | 프론트는 닉네임이 비어 있으면 닉네임 설정 화면으로 보낸다. exchange 응답만으로는 신규를 알 수 없어서 본인 조회(A-15)로 판단한다 | A-15 로 대체 |
| A-15 | **본인 조회 API** | 없음 (Bearer 토큰) | `User` (email, nickname, isPublic, tutorialCompleted, imageUrl …) | 프론트는 `GET /api/auth/me` 를 쓰는데 **백엔드에 없다.** `GET /user/detail?email=` 은 이메일을 파라미터로 요구하지만, 로그인 직후 프론트는 JWT 안의 이메일을 모른다(디코딩하지 않는다). 토큰 주체 기준으로 본인을 돌려주는 엔드포인트가 필요하다 | 협의 전 (**필요**) |
| A-16 | `/user/detail` 경로 접두 | — | — | 다른 API 는 모두 `/api/...` 인데 `UserController` 만 `/user/...` 다. 프론트 `API_ENDPOINTS` 는 `/api` 접두를 전제로 한다 — 어느 쪽으로 통일할지 확인 필요 | 협의 전 |
| A-9 | `POST /api/constellations/layout` | `{ musicIds: number[] }` (최대 30) | `{ points: [{ musicId, x, y }] }` — `x`, `y` 는 `-1 ~ 1` 정규화 좌표 | **별자리 오버레이의 모양** (PATH-01). 16차원 좌표를 2D로 압축한 고정 배치다. 레이어와 무관하게 **같은 곡 집합이면 항상 같은 모양**이어야 한다 — 플리 모양(예: 강아지)이 상품이 되려면 모양이 고정·재현 가능해야 하고, 나중에 "누가 만든 모양"으로 저장·거래하려면 서버에 있어야 한다. 클라이언트 MDS 로도 계산은 되지만 그러면 모양이 클라이언트 구현에 종속된다 | 협의 전 |

---

## 3. 백엔드 계산·전송 전제

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| B-1 | **상주 집합 전송**: 레이어 0은 뷰포트 스트리밍, 화면 안 곡이 게이트(약 5만곡) 이하로 좁혀지면 그 집합을 PC 16개 포함해 통째로 내려준다 (약 2.8MB) | 클라이언트가 재투영·모프를 하려면 PC 값을 들고 있어야 한다 | 협의 전 |
| B-2 | **레이어별 대표곡 선별 기준** (재생수? 밀도? 클러스터 중심?) | 레이어마다 다른 곡이 커버로 떠야 한다 | 협의 전 |
| B-3 | **축 라벨**: 레이어별 두 축의 일상어 라벨을 데이터 확정 후 내려줄 것 (MAP-06) | 지금은 프론트 임시값(`LAYER_AXES`) | 협의 전 |
| B-4 | **레이어 수 8개 / 대표곡 1000개** 전제 확인 | 프론트 상수(`LAYER_COUNT`, `REPRESENTATIVES_PER_LAYER`)가 이 값에 묶여 있다 | 협의 전 |
| B-5 | **재생 로그 호출 빈도 증가**: 지도에서 별을 클릭하면 그 곡이 곧바로 재생되므로 (MAP-08 합치기, S15P21A405-225) 클릭 한 번마다 `POST /music/{id}/play` 가 나간다. 탐색 중 연속 클릭이면 짧은 간격의 로그가 연달아 쌓인다 | 쓰기 부하와 통계(탐험왕·재생수) 해석에 영향. 서버 쪽에서 디바운스·최소 재생시간 필터가 필요한지 확인 필요 | 협의 전 |

---

## 4. 실시간(소켓) 필요 항목

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| S-1 | 따라가기 동기화 — 인솔자의 동작을 **세 종류 이벤트로 따로** 보내야 한다 (SOCIAL-07): ① `leader:view` = 곡 클릭(`viewingMusicId`) ② `leader:play` = 재생 시작(`playingMusicId`) ③ `leader:layer` = 레이어 전환(`layer`) | 뷰는 ①에서 먼저 움직이고, 우주선은 ②가 와야 출발한다. 두 개를 한 이벤트로 합쳐 보내면 이 연출이 불가능하다 | 협의 전 |
| S-2 | 따라가기 자동 종료: 인솔자 접속 종료·비공개 전환 시 (SOCIAL-10-1) | 서버가 알려줘야 한다 | 협의 전 |
| S-3 | 접속 상태·현재 탐색 좌표 실시간 관리 (USER-03) | 주변 사람 목록의 실시간성 | 협의 전 |
| S-4 | 반응 전송·수신 (SOCIAL-02, SOCIAL-04 쿨다운) | 같은 영역 사용자에게 즉시 전달 | 협의 전 |
| S-5 | 따라가는 인원 수 (SOCIAL-11), 만난 횟수 카운팅 (SOCIAL-05) | 서버 집계 필요 | 협의 전 |
