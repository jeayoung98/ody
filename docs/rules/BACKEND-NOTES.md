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
| B-13 | 인증 관련 에러 코드 | **구현됨** (backend/dev `AuthErrorCode`): `EMAIL_ALREADY_EXISTS` `NICKNAME_ALREADY_EXISTS` `INVALID_CREDENTIALS` `PASSWORD_MISMATCH` `INVALID_PASSWORD_FORMAT`(영문+숫자 8~72자) `INVALID_NICKNAME_LENGTH`(2~20자) | 프론트 `ImplementedErrorCode` 에 반영 완료. 목 라우트도 같은 코드로 답한다 | 반영됨 |
| B-14 | **구글 로그인 진입 경로** | `/oauth2/authorization/google` (Spring Security 기본, SecurityConfig permitAll). `/api/auth/google` 은 존재하지 않는다 | 프론트가 `/api/auth/google` 로 보내고 있었다 → 경로 수정 완료 | 반영됨 |
| B-15 | 배포 서버 응답 | `https://j15a405a.p.ssafy.io` 의 `/actuator/health` 도 404 | 실제 구글 로그인은 아직 한 번도 성공 경로를 밟지 못했다. 배포 주소·프로필 확인 필요 | 협의 전 |
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
| E-5 | `music` | 곡 상세에 필요한 필드가 ERD에 없음: 앨범 커버 URL, 발매 국가, 언어, 작곡가, 작사가, 무드 태그 | 곡 상세 패널 구성 항목 (SONG-02, 유저 플로우) | 상세 화면의 절반이 빈칸 | 일부 해소 — 앨범 커버는 `music.album_mbid` 로 대체했다(A-47). 나머지는 협의 전 |
| E-6 | `user` | `nickname` 에 **UNIQUE 제약 + NOT NULL**. 길이 2~20자 검증 | 가입 직후 닉네임을 직접 받고 **중복을 허용하지 않는다** (AUTH-01, 2026-09-10 기획 확정). 지금은 `VARCHAR(100) NULL` 로 중복이 들어간다 | 같은 닉네임이 여러 개 생겨 프로필·따라가기에서 사람을 구분할 수 없다 | 협의 전 |
| E-7 | `user` | 비밀번호 해시 컬럼 추가(예: `password_hash VARCHAR(255) NULL`) + **PK 정책 재검토** | 이메일·비밀번호 가입이 확정됐다 (AUTH-01). 현재 PK 는 "구글 계정 이메일"이라 소셜 가입만 전제한다 | 이메일 가입 자체가 불가능 | 협의 전 |
| E-8 | `music_like` 테이블 신규 | PK `(email, music_id)`, `liked_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `user`·`music` FK, `(email, liked_at DESC)` 인덱스. DDL: `backend/src/main/resources/db/music_like_001_table.sql` | 곡 단위 좋아요(MUSIC-LIKE). 좋아요 목록은 **가상 플레이리스트**라 `playlist`/`playlist_item` 레코드를 만들지 않는다 | 곡 좋아요와 마이페이지 좋아요 목록 전부 불가 | ⚠️ **미적용** — 2026-09-22 09:09 KST 운영 `ody` DB 조회 결과 테이블 없음. DDL 작성만 됨 (S15P21A405-512) |
| E-9 | `taste_analysis` 테이블 신규 | `(email, analysis_date)` 단위 생성 이력 + snapshot hash·버전·결과 JSON·lease. PENDING 에만 걸리는 partial unique index 와 lease 인덱스 포함. DDL: `backend/src/main/resources/db/taste_analysis_001_table.sql` | AI 취향 리포트의 1일 1회 제한, 동시 생성 배제, snapshot 재사용, stale 판정의 저장소 | 취향 분석 API 전체 불가 | ⚠️ **미적용** — 운영 DB 에 없음. `CREATE INDEX CONCURRENTLY` 가 들어 있어 **전체를 한 트랜잭션으로 실행하면 안 된다** (S15P21A405-512) |

---

## 2. 신규 API / 응답 변경

| # | API | 요청 | 응답 | 이유 | 상태 |
| --- | --- | --- | --- | --- | --- |
| A-1 | `GET /api/map/songs` | 없음 (또는 뷰포트·게이트 파라미터) | `MapPoint[]` = `{ musicId, pc[16], genreId, weight, title, artist, playable }` | 지도 렌더링·재투영의 원본. 실서비스는 레이어 0 스트리밍 + 게이트 이하 상주 집합 통째 전송 | 협의 전 |
| A-2 | `GET /api/map/layers/{layer}/representatives` | layer | `{ layer, musicIds[] }` | 레이어마다 **다른 대표곡**을 앨범 커버로 띄운다. 선별 기준은 백엔드가 정함 | 협의 전 |
| A-3 | `GET /api/users/nearby?layer={n}` | layer | `NearbyUser[]` | 지금 있는 **영역(레이어)의 사용자만** 내려줘야 한다. 레이어마다 다른 사람이 보임 (SOCIAL-01) | 협의 전 |
| A-4 | `NearbyUser` 응답 | — | `viewingMusicId` **추가 필요** | 따라가기 시 좌표 두 개가 필요하다: `musicId`=재생 중(우주선 위치), `viewingMusicId`=인솔자가 보고 있는 상세 곡(뷰포트·우측 패널 기준) (SOCIAL-07) | 협의 전 |
| A-5 | **`GET /api/music/journey?start=&end=`** | 두 곡 ID | `{ musicCnt, totalDuration, path[] }` — **`musicCnt` 2~20, 중앙값 6** | **16차원 임베딩 거리 기준**으로 경로를 뽑아야 한다. 2D 평면 직선으로 뽑으면 레이어 0에서 일직선이 되어 별자리 모양이 안 나온다 (PATH-01) | ✅ 구현됨 (S15P21A405-61) · **2026-09-13 곡 수 개정(007/286)** — 아래 참조 |
| A-6 | ~~`GET /api/map/nearby/{musicId}`~~ → **`GET /api/music/nearby`** | `id` | `{ center, neighbors[], lowSimilarity }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10). **경로 폐기** — `map/nearby/{musicId}` 는 좌표 기준 탐색을 표현할 수 없다. 계약은 api-spec §3.5 | ✅ 구현됨 (S15P21A405-59) · 이름은 BE3·팀 협의 중(`/music/neighbors` 와 구분 필요) |
| A-8 | `GET /api/music/{id}/representative-layers` | musicId | `{ musicId, layers: number[] }` (오름차순) | 검색 결과를 누르면 그 곡이 **대표곡으로 노출되는 첫 레이어**로 이동해야 한다. 한 곡이 여러 레이어에서 대표곡일 수 있다. 클라이언트가 8개 레이어 대표곡을 전부 들고 있을 수 없으므로 서버가 계산해야 한다 (SEARCH-01) | 협의 전 |
| A-7 | `POST /api/music/{id}/play` | `{ source, playedMs }` | ok | 재생 로그 (`play_history`). `source` 값은 `MAP` / `JOURNEY` / `PLAYLIST` / `FOLLOW` | 협의 전 |
| A-10 | `POST /api/auth/signup` | `{ email, password, nickname }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 가입 (AUTH-01) | ✅ 구현됨 (backend/dev, S15P21A405-121) · 프론트 반영 완료 |
| A-11 | `POST /api/auth/login` | `{ email, password }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 로그인 (AUTH-02) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-12 | `GET /api/users/nickname-available?nickname=` | nickname | `{ available }` | 닉네임 중복 확인 (AUTH-01) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-13 | `PATCH /api/auth/nickname` (경로 협의 필요) | `{ nickname }` | `{ nickname }` | **구글 신규 사용자의 닉네임 저장.** `CustomOAuth2UserService` 가 신규 구글 사용자의 nickname 을 의도적으로 비워두는데, 그 값을 채울 엔드포인트가 없다. `UserController` 에는 `GET /user/detail` 뿐이다. 프론트는 이 API 를 목으로 대체해 두었다 | 협의 전 (**필요**) |
| A-14 | 신규 가입 여부 판단 | — | 본인 조회 응답의 `nickname` 이 null 이면 신규로 본다 | 프론트는 닉네임이 비어 있으면 닉네임 설정 화면으로 보낸다. exchange 응답만으로는 신규를 알 수 없어서 본인 조회(A-15)로 판단한다 | A-15 로 대체 |
| A-15 | **본인 조회 API** | 없음 (Bearer 토큰) | `User` (email, nickname, isPublic, tutorialCompleted, imageUrl …) | 프론트는 `GET /api/auth/me` 를 쓰는데 **백엔드에 없다.** `GET /user/detail?email=` 은 이메일을 파라미터로 요구하지만, 로그인 직후 프론트는 JWT 안의 이메일을 모른다(디코딩하지 않는다). 토큰 주체 기준으로 본인을 돌려주는 엔드포인트가 필요하다 | 협의 전 (**필요**) |
| A-16 | `/user/detail` 경로 접두 | — | — | 다른 API 는 모두 `/api/...` 인데 `UserController` 만 `/user/...` 다. 프론트 `API_ENDPOINTS` 는 `/api` 접두를 전제로 한다 — 어느 쪽으로 통일할지 확인 필요 | 협의 전 |
| A-17 | `GET /api/music/search` 조건 검색 | `query+page` 또는 `artist+page` 또는 `music+artist+page` | 기존 `PageResponse<MusicSummary>` 유지: `content/page/size/hasNext` | SEARCH-01의 아티스트 검색과 동명 음악 좁히기. Frontend는 단일 검색바의 `음악`/`아티스트` 칩으로 조건을 만든다. `query` 혼합·`music` 단독·빈 값은 400 `INVALID_INPUT`; 조건 변경 시 page=0 | Backend 구현됨 (S15P21A405-365) · Frontend 연동 대기 · 현재 임시 `permitAll`로 401 재검증 필요 |
| A-9 | `POST /api/constellations/layout` | `{ musicIds: number[] }` — **2개 이상 30개 이하, 중복 불가**. 요청 본문의 다른 필드(프론트가 지금 싣는 `points`)는 **무시한다** | `{ points: [{ musicId, x, y }] }` — 요청과 같은 개수·같은 나열 순서, `x`·`y` 는 `-1 ~ 1`. 오류: 개수·중복·값 위반 400 `INVALID_INPUT`, 요청한 곡 중 하나라도 없거나 좌표가 없으면 404 `MUSIC_NOT_FOUND`(부분 배치 없음) | **별자리 오버레이의 모양** (PATH-01). 좌표 원천은 서빙 baseline `v2.1-pca16` 의 `music.location` 하나다 — 요청자가 보낸 좌표는 쓰지 않는다. 그 곡 집합만의 분산이 가장 큰 두 방향으로 투영하므로 **레이어와 무관하고, 같은 곡 집합이면 항상 같은 좌표**다. 다만 곡 집합이 바뀌면 축도 바뀐다 — 부분집합이 전체집합 모양의 일부와 같지는 않다. 응답의 `x`·`y` 는 지도(PC 축) 좌표가 아니라 그 집합만의 표시용 투영이다. ⚠️ **프론트**: `playlist-panel.tsx` 가 플레이리스트 곡을 개수 제한 없이 보내고 있어 31곡 이상이면 400 이다 — 30곡으로 잘라 보내야 한다(2026-09-13 합의, 서버는 임의로 자르지 않는다) | ✅ 구현됨 (S15P21A405-265, `backend/feat/...-265-constellation-layout-api`) · 프론트 반영 대기 |
| A-30 | `GET /api/music/major` | 기존 `level`·누적 범위 + optional `size` | 기존 `MajorResponse`; `content`는 요청한 `size` 이하 | 레이어별 상주 곡 수를 1,000 → 3,000 → 10,000으로 실측하기 위한 임시 측정 파라미터. 생략 시 현행 약 1,000곡 동작 유지 | 명세 반영 · 구현 전 |
| A-31 | `GET /api/music/major` | 변경 없음 | `MapPoint.youtubeUrl` 제거. `playable` 유지. `/api/music/detail`의 `youtubeUrl`은 유지 | 지도에서 읽지 않는 검색 URL이 응답의 약 25%를 차지함 | 명세 반영 · 구현 전 |
| A-32 | `GET /api/music/major` | 변경 없음 | `MapPoint.pc[16]` 각 값을 소수점 이하 최대 3자리로 반올림 | 지도 표시 정밀도는 유지하면서 좌표 페이로드를 줄임 | 명세 반영 · 구현 전 |
| A-33 | `PATCH /api/user/nickname` | `{ nickname }` | `{ nickname }` | **`PATCH /api/user/profile` 을 대체한다.** 이전 API 는 닉네임과 `imageUrl` 문자열을 함께 받았는데, 프로필 사진은 실제 파일 업로드가 필요해 두 API 로 나눴다. 오류: 빈 값 400 `INVALID_INPUT`, 2~20자 위반 400 `INVALID_NICKNAME_LENGTH`, 중복 409 `NICKNAME_ALREADY_EXISTS`. 대상은 토큰 주체 본인 | ✅ 구현됨 (S15P21A405-426) · **프론트 반영 필요** |
| A-34 | `PATCH /api/user/image` | `multipart/form-data`, part 이름 **`file`** (jpg·png·gif·webp, 5MB 이하) | `{ imageUrl }` — 절대 URL | 프로필 사진 업로드. 대상은 토큰 주체 본인이라 요청 본문에 사용자 식별자가 없다. 형식은 클라이언트 `Content-Type` 이 아니라 실제 바이트로 판별한다. 오류: 형식 위반·빈 파일 400 `INVALID_IMAGE_FILE`, 크기 초과 413 `IMAGE_FILE_TOO_LARGE`, 저장 실패 500 `IMAGE_UPLOAD_FAILED`. 교체 시 이전 업로드 파일은 삭제되고 구글 사진(외부 URL)은 건드리지 않는다 | ✅ 구현됨 (S15P21A405-426) · **프론트 반영 필요** |
| A-35 | 구글 로그인의 `imageUrl` | 변경 없음 | 사용자가 사진을 바꾼 뒤에는 구글 사진으로 되돌아가지 않는다 | `touchLogin` 이 로그인마다 `image_url` 을 구글 사진으로 덮어써서, 업로드한 사진이 다음 로그인에 사라졌다. 이제 `image_url` 이 비어 있을 때만 구글 값을 채운다 | ✅ 구현됨 (S15P21A405-426) |
| A-36 | `GET /api/user/detail` | 변경 없음 | **`playedMusicCnt`(int) 추가** — 그 사용자가 재생한 곡 수, 같은 곡을 여러 번 들어도 1곡 | 마이페이지·상대 프로필에 표시한다. `play_history` 에서 `COUNT(DISTINCT music_id)` 로 센다. 비공개 사용자 판정 뒤에 세므로 볼 수 없는 사용자의 기록은 읽지 않는다. ⚠️ **DB 담당**: `db/play_history_001_email_music_index.sql` 의 `(email, music_id)` 인덱스를 운영 DB 에 적용해야 한다 — 없으면 로그가 쌓일수록 상세 조회가 느려진다 | ✅ 구현됨 (S15P21A405-430) · **프론트 반영 필요** · **인덱스 적용 필요** |
| A-37 | `POST /api/user/follow/insert` | `{ followeeEmail }` | `{ followerEmail, followeeEmail, isFollowing, followeeFollowerCnt }` | 팔로우 등록 (api-spec §2.5). 거는 쪽은 토큰 주체라 요청에 없다. 오류: 자기 자신 400 `SELF_FOLLOW_NOT_ALLOWED`, 없는 사용자 404 `USER_NOT_FOUND`, 중복 409 `ALREADY_FOLLOWING`. ⚠️ **경로가 정본과 다름** — 정본은 `/user/follow/insert` 지만 이 저장소 컨트롤러 컨벤션(`/api/user/...`)에 맞췄다 (A-16 과 같은 사안) | ✅ 구현됨 (S15P21A405-433) · **프론트 반영 필요** |
| A-38 | `POST /api/user/follow/delete` | `{ followeeEmail }` | A-37 과 같은 형태, `isFollowing: false` | 팔로우 해제 (api-spec §2.6). 팔로우 중이 아니어도 200 (멱등). 오류: 없는 사용자 404 `USER_NOT_FOUND` | ✅ 구현됨 (S15P21A405-433) · **프론트 반영 필요** |
| A-39 | `GET /api/user/follow/list?email=&type=&page=` | `type` 은 `follower` / `following` (대소문자 무시), `page` 는 0부터 | `{ type, content[], page, size, hasNext }`. 항목: `email`, `name`, `nickname`, `imageUrl`, `isPublic`, `isFollowing`, `lastActiveAt`, **`meetingCnt`** | 팔로워·팔로잉 목록 (api-spec §2.8). `isFollowing` 과 `meetingCnt` 는 목록 소유자가 아니라 **토큰 주체 기준**이다. 비공개 사용자의 목록은 본인만 볼 수 있다(`USER_PRIVATE`). ⚠️ **정본과 두 곳 다름** — ① `totalElements`·`totalPages` 없음(공통 래퍼 결정 S15P21A405-255 와 동일) ② `meetingCnt` 추가(요청 사항, 명세에 없음) | ✅ 구현됨 (S15P21A405-433) · **프론트 반영 필요** · **기획 확인 필요(meetingCnt)** |
| A-47 | `GET /api/music/detail` · `GET /api/music/search` · `GET /api/music/nearby` · `GET /api/music/journey` · `GET /api/playlist/detail` | 변경 없음 | **`MusicDetail.genres`·`MusicSummary.genres` 필드 제거** — 위 API 응답의 곡 객체에서 `genres` 가 사라진다 | DB `genre`·`music_genre` 테이블이 삭제돼 장르를 읽을 원천이 없다. 빈 배열로 남기지 않고 필드를 없앴다(계약에 죽은 필드를 두지 않기 위해). 지도 `MapPoint.genreId` 는 무장르(10) 고정으로 그대로다. ⚠ **프론트**: `types/music-detail.ts`·`types/music.ts` 의 `genres: Genre[]`, `journey.ts` 의 `genreName`, 상세 패널(`song-header.tsx`·`song-info-grid.tsx`)·플레이어바·여정 결과의 장르 표시를 걷어내야 한다 | ✅ 구현됨 (S15P21A405-475, `backend/fix/S15P21A405-475-remove-genre-tables`) · **프론트 반영 필요** · **기획 확인 필요(SONG-02 장르 항목)** |
| A-40 | `GET /api/user/detail` | 변경 없음 | `followerCnt`·`followingCnt`·`isFollowing` 이 **실제 값**으로 바뀜 | 팔로우 구현 전까지 0/0/false 고정이던 placeholder(S15P21A405-70)를 집계로 교체했다. `isFollowing` 은 토큰 주체가 조회 대상을 팔로우 중인지이고 본인 조회면 항상 false | ✅ 구현됨 (S15P21A405-433) |
| A-41 | `POST /api/playlist/like` | `{ playlistId, liked }` — `liked` 는 토글이 아니라 **목표 상태** | `{ playlistId, liked, likeCnt }` — `likeCnt` 는 변경 후 값 | 플레이리스트 좋아요. 정본 §4 는 "`like_cnt` 를 어느 API 에서도 다루지 않는다"고 적혀 있어 **신규 계약**이다. 남의 플레이리스트에도 누를 수 있다. 같은 요청을 반복해도 숫자가 부풀지 않는다(멱등). 오류: 없는 플레이리스트 404 `PLAYLIST_NOT_FOUND`, 필드 누락 400 `INVALID_INPUT`. ⚠️ **DB 담당**: `db/playlist_like_001_table_and_like_cnt.sql` 을 먼저 적용해야 한다 — `playlist_like` 테이블 생성과 `like_cnt` NOT NULL DEFAULT 0 변경이 들어 있다 | ✅ 구현됨 (S15P21A405-442) · **프론트 반영 필요** · **DDL 적용 필요** |
| A-42 | `playlist_like` 테이블 | — | — | 누가 어떤 플레이리스트를 좋아요 했는지 기록한다. PK `(playlist_id, email)` 로 같은 사람의 중복 좋아요를 막고, `playlist.like_cnt` 는 이 기록의 집계 사본이라 한 트랜잭션에서 함께 갱신한다. 프론트 `PlaylistDetail.isLiked` 와 "좋아요한 플리" 목록의 출처가 된다 — **두 기능은 아직 구현 전이다** | ✅ DDL 작성됨 (S15P21A405-442) · **적용 필요** |
| A-43 | `GET /api/playlist/detail` | 변경 없음 | **`likeCnt`(int)·`isLiked`(boolean) 추가** | 프론트 `PlaylistDetail.isLiked` 를 채운다. `isLiked` 는 플레이리스트 소유자가 아니라 **요청한 사람**이 눌렀는지다. ⚠️ 이 API 는 지금도 **소유자만** 볼 수 있다(`FORBIDDEN`) — 좋아요는 남의 플레이리스트에도 누를 수 있으므로, 남의 플레이리스트 상세를 여는 화면이 필요하면 접근 범위를 팀에서 정해야 한다 | ✅ 구현됨 (S15P21A405-447) · **프론트 반영 필요** · **접근 범위 협의 필요** |
| A-44 | `GET /api/playlist/liked?email=` | `email`(소유자 아닌 **좋아요를 누른 사람**) | `{ content: [{ playlistId, playlistName, musicCnt, likeCnt, ownerEmail, ownerNickname, likedAt }] }` | 피드의 "좋아요한 플리" 탭. 남이 만든 플레이리스트가 섞이므로 소유자 정보를 함께 내려준다. 정렬은 좋아요를 누른 시각 역순. 공개 범위는 `/playlist/search` 와 같다 — 비공개 사용자의 목록은 본인만 볼 수 있다. 페이지네이션 없음(`/playlist/search` 와 동일). 오류: `USER_NOT_FOUND`, `USER_PRIVATE` | ✅ 구현됨 (S15P21A405-447) · **프론트 반영 필요** |
| A-45 | `GET /api/stats/weekly` | 없음 (전체 집계) | `{ weekStart, weekEnd, discovery[], explore[], contribution[] }`. 각 항목: `{ rank, email, nickname, imageUrl, count }`, 각 10명 이하 | 이번 주 랭킹. 구간은 **한국 시간 월요일 00:00 이상 ~ 다음 월요일 00:00 미만**이고 서버 시간대와 무관하다. `discovery` 는 그 주에 처음 재생된 곡 수, `explore` 는 재생 횟수(같은 곡 중복 포함), `contribution` 은 신고 건수(비로그인 신고 제외). 동점자도 서로 다른 순위를 받고 같은 점수면 email 순이다. 탈퇴해 `user` 에 없는 사람은 순위에서 빠진다. ⚠️ **DB 담당**: `db/music_discovery_001_table_and_indexes.sql` 적용 필요 — `music_discovery` 테이블 생성, 과거 재생 기록 백필, 세 테이블의 구간 인덱스가 들어 있다 | ✅ 구현됨 (S15P21A405-448) · **프론트 반영 필요** · **DDL 적용 필요** |
| A-47 | `GET /api/music/major` · `GET /api/music/detail` | 기존과 같음 | 응답에 `albumMbid` 추가 (대표곡은 `content[]` 원소에, 곡 상세는 top-level 에) | 앨범(MusicBrainz release) MBID. 커버를 여는 열쇠는 `mbid`(recording) 가 아니라 이 값이다 — FE 가 Cover Art Archive 를 직접 받는다(S15P21A405-518). 출처는 `music.album_mbid`(S15P21A405-291 적재분) 이고 **값이 없는 곡은 `null`** 이라 절차적 커버 폴백이 계속 필요하다. Jackson 기본 설정이라 JSON 키는 **`albumMbid`** 이다(`album_mbid` 아님) | ✅ 구현됨 (S15P21A405-520) · **프론트 반영 필요** |
| A-46 | `music_discovery` 테이블 | — | — | 곡별 **최초 청취자**를 기록한다. `music_id` 가 PK 라 곡당 한 줄이고 그 줄을 만든 사람이 발견자다. 곡 재생(`MusicPlayService.play`) 때 `INSERT ... ON CONFLICT DO NOTHING` 으로 같은 트랜잭션에서 넣는다. ⚠️ **기록은 realtime 프로파일의 재생 경로에서만 쌓인다** — 그 경로를 타지 않는 재생은 발견왕에 반영되지 않는다 | ✅ 구현됨 (S15P21A405-448) · **적용 필요** |
| A-48 | `POST /api/music/like` | `{ musicId, liked }` — `liked` 는 토글이 아니라 **목표 상태** (A-41 과 같은 규약) | `{ musicId, liked, likedAt }` — 취소면 `likedAt` 은 `null` | 곡 단위 좋아요. 같은 요청을 반복해도 결과가 같다(멱등). 오류: 없는 곡 404 `MUSIC_NOT_FOUND`, 필드 누락 400 `INVALID_INPUT`. ⚠️ **DB 담당**: E-8 DDL 선적용 필요 | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** · **DDL 적용 필요** |
| A-49 | `GET /api/music/liked` | 없음 (인증 주체 기준) | `{ content: [{ musicId, title, artist, duration, youtubeUrl, videoId, likedAt }] }` — 최근 좋아요순 | 마이페이지의 **가상 플레이리스트**. 별도 `playlist` 레코드를 만들지 않으므로 `playlistId` 가 없다. 목록의 임의 곡부터 끝까지 기존 재생 큐에 그대로 넣는 것이 전제(SC-009). 페이지네이션 없음. ⚠️ **응답에 `albumMbid` 가 없다** — A-47 로 곡 상세·대표곡에는 들어갔지만 이 목록에는 아직 없어서, 목록에서 바로 앨범 커버를 그리려면 필드 추가 합의가 필요하다 | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** · **`albumMbid` 추가 여부 협의 필요** |
| A-50 | `GET /api/taste-analysis` | 없음 (인증 주체 기준) | `{ state, counts{ totalLiked, valid, excluded, exclusions }, reportEligibility{ eligible, level, additionalLikesNeeded }, reference{ bundleVersion, referenceVersion, axisLabelVersion, analysisPolicyVersion }, axes[], points[{ musicId, title, artist, coordinates[16] }], report{ level, aiGenerated, fresh, summary, narratives[{ findingId, text, evidence }], analyzedAt, generatedAt, lastRefreshedAt }, generation{ status, generatedThisRequest, dailyLimitUsedToday, canRetry, failureCode, nextAvailableAt } }` | 현재 좋아요 곡의 **기존 PC 좌표** 통계와 마지막 성공 리포트를 함께 준다. PCA 재학습·좌표 재산출은 이 기능 범위가 아니다. 유효 곡 10개 미만은 분포만, 10~29 `INITIAL`, 30 이상 `STANDARD`. `report.fresh=false` 면 좋아요가 바뀌어 리포트가 STALE 이라는 뜻이다. 오류: 기준 산출물 없으면 503 `TASTE_REFERENCE_UNAVAILABLE` | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** · **기준 산출물 필요** |
| A-51 | `POST /api/taste-analysis` | 없음 (인증 주체 기준) | A-50 과 같은 스키마 | 사용자가 **버튼을 눌렀을 때만** 리포트를 생성한다. 성공한 생성만 KST 기준 1일 1회 한도를 차감한다. 같은 snapshot 이면 저장 결과를 재사용한다(`generation.status=REUSED`, GMS 미호출). GMS 실패는 `FALLBACK` 으로 내려가고 **한도를 차감하지 않으며 같은 날 재시도할 수 있다**. 오류: 생성 진행 중 409 `TASTE_ANALYSIS_IN_PROGRESS`(`error.details.nextAvailableAt` = lease 만료 시각), 유효 곡 10개 미만 400 `TASTE_INSUFFICIENT_SAMPLE`, 당일 한도 소진 429 `TASTE_DAILY_LIMIT`(`error.details.nextAvailableAt` = 다음 KST 자정), 기준 산출물 없음 503 `TASTE_REFERENCE_UNAVAILABLE` | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** · **기준 산출물·`GMS_KEY` 필요** |

> **A-5 곡 수 개정 (2026-09-13, BE2)** — 여정 응답의 `musicCnt` 범위가 **12~22 에서 2~20 으로** 바뀐다.
> 무작위 쌍 기준 **중앙값이 12곡에서 6곡**이 되고, **중간 곡 없이 출발·도착 2곡만 나가는 응답이 정상**이다(오류 아님).
>
> 왜 짧아지나 — 좌표 공간에서 임의의 두 곡 사이에 "서로 구별되는" 곡이 평균 **6.8개**밖에 들어가지 않는다(임의 지점의 최근접 곡까지 거리 p50 2.272, 두 곡 사이 거리 중앙값 15.52). 이전에는 거리와 무관하게 중간역을 10개 이상 꽂아서, 가까운 두 곡 사이 경로가 **직선의 8.6배**를 돌며 엉뚱한 곡으로 채워졌다. 고친 뒤 우회 배수는 1.0~1.5 다.
>
> **프론트 확인 필요**: 곡 수를 하드코딩한 레이아웃이 있으면 어긋난다. 2곡·3곡 목록의 표시 방식도 정해야 한다.
> 별자리 배치 API(A-9, 최대 30곡)에는 영향 없다 — 여정은 항상 20곡 이하다.

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
| S-6 | `/app/presence/join {requestSeq, layer, musicId}`: 최초 입장은 요청 곡, 이후 레이어 이동은 서버 현재 곡 유지. 성공 `PRESENCE_JOINED`, 실패 개인 오류 큐. 프론트는 ACK 뒤 viewport·새 곡 play 진행 | REST와 STOMP 사이 처리 순서를 ACK로 보장하고 이전 소켓 요청을 epoch로 차단 | 백엔드 반영 · 프론트 반영 필요 (S15P21A405-423) |
