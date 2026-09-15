# 백엔드·ERD 영향 목록 (Frontend → Backend)

프론트 구현 과정에서 나온 **백엔드·ERD 협의 항목**을 모은 문서다.
프론트가 임의로 정할 수 없는 것들이며, 목(mock) API로 임시 구현해둔 것도 전부 여기에 적는다.

- 상태: `협의 전` / `협의 중` / `반영됨`
- 최종 수정: 2026-09-12

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
| B-15 | ~~배포 서버 응답 404~~ **주소가 틀렸던 것** | 앱 노드는 `https://j15a405.p.ssafy.io` 다. `j15a405a` (a 붙음) 는 Jenkins·Grafana 가 있는 master-node 라 API 가 없다 | `.env.example` 과 `next.config.ts` 의 `BACKEND_ORIGIN` 을 올바른 주소로 고침 | 반영됨 (2026-09-12) |
| B-10 | **에러 코드가 API 명세서 §0.5와 다름** | 구현: `UNAUTHENTICATED` `INVALID_TOKEN` `REFRESH_TOKEN_NOT_FOUND` `REFRESH_TOKEN_MISMATCH` `INVALID_EXCHANGE_CODE` `INVALID_INPUT` `INTERNAL_SERVER_ERROR` / 명세서: `VALIDATION_ERROR` `TOKEN_EXPIRED` `REFRESH_TOKEN_INVALID` `OAUTH_FAILED` `INTERNAL_ERROR` … | **어느 쪽이 맞는지 백엔드 확인 필요.** 확정 전까지 `src/types/api.ts` 는 양쪽을 모두 허용 | 협의 전 |
| B-11 | OAuth 리다이렉트 URI | `app.oauth.frontend-redirect-uri` 설정값으로 이동. 교환 코드는 1회용, TTL 30초 | 프론트 착지점은 `/oauth/redirect`. **이 값이 그렇게 설정돼 있는지 백엔드 확인 필요** | 협의 전 |
| B-12 | ~~인증 외 API 전무~~ | 배포본(`origin/backend/jenkins`)에 Music·Journey·Playlist·UserDetail·UserProfile 컨트롤러가 생겼다. 다만 **대부분 nginx 를 통과하지 못한다** — B-16 참고 | 도달 가능한 것만 실연동(S15P21A405-221), 나머지는 목 유지 | 갱신됨 (2026-09-12) |

---

## 0-1. 배포 서버 실호출 대조 (2026-09-12) — **백엔드·인프라 확인 요청**

`https://j15a405.p.ssafy.io` 를 직접 호출하고, 배포 브랜치(`origin/backend/jenkins`) 컨트롤러와 대조한 결과다.
배포본은 `master` 도 `backend/dev` 도 아닌 **`backend/jenkins`** 다 (근거: master 엔 springdoc 이 없는데 실서버는
swagger 를 서빙하고, `backend/dev` 는 swagger 를 `/api/` 아래로 옮겼는데 실서버는 루트 `/swagger-ui/` 에서 답한다).

| # | 항목 | 확인된 사실 | 없으면 안 되는 것 | 상태 |
| --- | --- | --- | --- | --- |
| B-16 | ~~`/api` 접두가 없는 컨트롤러는 프론트가 부를 수 없다~~ | **해결.** 2026-09-12 배포에서 `MusicController`·`PlaylistController`·`UserController` 가 전부 `/api/**` 로 정렬됐다. 배포 서버 `/api/v3/api-docs` 로 27개 경로를 직접 확인했고, 구 경로(`/music/**`·`/playlist/**`)는 이제 SPA 로 떨어진다 | 곡 검색·상세·대표곡·플레이리스트 8종·남의 프로필이 모두 살아났다 | ✅ 해결 (2026-09-12 배포 확인) |
| B-17 | **CORS 가 모든 오리진을 거부한다** | `Origin` 헤더가 붙으면 origin 과 무관하게 `403 Invalid CORS request`. `https://j15a405.p.ssafy.io` 자기 자신도, `http://localhost:3000` 도 403 이다 — 서버의 `CORS_ALLOWED_ORIGINS` 값이 맞지 않다. **2026-09-12 재확인, 그대로다** | 브라우저에서 백엔드를 직접 호출하는 모든 경로. 프론트는 Next rewrite 프록시로 우회 중이다(S15P21A405-221) — **정상화되면 프록시를 걷어내고 로그인을 실연동으로 되돌릴 수 있다** | 협의 전 (**우회 중**) |
| B-18 | ~~Swagger 스펙이 500 이라 문서를 못 본다~~ | **해결.** 문서가 `/api/` 아래로 옮겨졌다 — `/api/swagger-ui/index.html` 200, `/api/v3/api-docs` 200(인증 불필요). 구 경로 `/v3/api-docs/` 는 이제 401 이다 | 프론트가 계약을 확인할 방법이 생겼다. 이후 계약 대조는 **배포된 api-docs 를 기준**으로 한다 | ✅ 해결 (2026-09-12 배포 확인) |
| B-19 | `PATCH /api/user/tutorial-completed` · `PATCH /api/user/profile` | 둘 다 도달 가능. 본문 없음/`{nickname?, imageUrl?}`, 토큰 주체 본인 대상이라 email 을 받지 않는다 | — | ✅ 프론트 반영 완료 |
| B-20 | 구글 OAuth 리다이렉트 착지점 | 진입(`/oauth2/authorization/google`)은 정상 302 이고 `redirect_uri` 도 맞다. 다만 콜백 뒤 프론트로 되돌리는 `app.oauth.frontend-redirect-uri` **서버 설정값은 확인할 수 없었다** | 로컬(`localhost:3000`)에서 구글 로그인 테스트. 배포 SPA 주소로 고정돼 있으면 로컬 개발자는 구글 로그인을 못 한다 | 협의 전 (B-11 연장) |

| B-21 | `genreId`·`youtubeUrl`·`playable` — **백엔드 반영 완료, 배포 대기** | 2026-09-12 BE 회신: `genreId` 0 → **10(무장르)** (S15P21A405-249), `MapPoint` 에 **`youtubeUrl` 필드 추가**, `playable` 은 상수 true 가 아니라 `youtubeUrl != null` (제목·아티스트가 둘 다 빈 곡 3,977개는 false). `backend/dev` 에서 확인했다 | 프론트는 `MapPoint.youtubeUrl` 을 받도록 맞췄다 (S15P21A405-251). **배포 서버는 아직 옛 값이다** — 2026-09-12 실측 1,094곡 전부 `genreId=0`·`youtubeUrl` 없음·`playable=false`. 배포되면 지도 별 색이 회청색으로, 재생 가능 표시가 살아난다. `weight` 는 여전히 0 균일이라 별 크기 채널은 죽어 있다 | 배포 대기 (**weight 대체 지표는 협의 중**) |
| B-22 | ~~지도 상주 집합이 `/api` 아래에 없어서 곡 ID 가 서로 안 맞는다~~ | **해결.** `GET /api/music/major` 가 도달 가능해져 지도·주변 탐색·경로 탐색이 **같은 출처**를 쓴다 | 프론트는 `BACKEND_ACCESS_TOKEN` 만 있으면 네 경로가 전부 실데이터로 돈다 (S15P21A405-242) | ✅ 해결 (2026-09-12 배포 확인) |
| B-23 | **곡 검색이 18~20초 걸린다** | `GET /api/music/search?query=&page=0` 을 화면에서 태우면 응답까지 18,342ms · 20,777ms 가 걸렸다 (2026-09-12, 콘솔 로그 실측). 아주 긴 검색어(3,000자)는 60초 뒤 **504** 였다 | 검색은 유저 테스트에서 쓰는 기능이다. 이 속도면 사용자가 결과를 기다리지 않고 이탈한다. 175,569건을 세는 `totalElements` 나 `%LIKE%` 풀스캔이 원인인지 확인 필요 | 협의 전 (**필요**) |
| B-24 | **없는 대상에 404 가 아니라 500 을 준다** | `GET /api/user/detail?email=<없는 이메일>`, `GET /api/playlist/search?email=<없는 이메일>`, `GET /api/playlist/detail?playlistId=1` 이 모두 `500 INTERNAL_SERVER_ERROR` 였다 (2026-09-12 실호출) | 프론트가 **"없음"과 "서버 장애"를 구분할 수 없다.** 없으면 404 + 도메인 에러 코드여야 사용자에게 맞는 안내를 고를 수 있다. 지금은 전부 같은 오류 화면이 된다 | 협의 전 |

### 실데이터 / 목 현황 (2026-09-12 실호출 확인)

A-17 해제 덕에 토큰 없이 아래가 **배포 백엔드의 실제 곡**으로 돈다. 나머지는 목이다.

| 기능 | 화면 | 프론트 라우트 | 백엔드 | 상태 |
| --- | --- | --- | --- | --- |
| 지도 상주 집합 (MAP-01·04) | 별지도 본체 · 겹 이동 | `/api/map/songs` | `GET /api/music/major` | ✅ 실데이터 (레이어 0 = 1,094곡, 파고들기 level=2 누적 범위까지 확인) |
| 곡 검색 (SEARCH-01) | 상단 검색창 | `/api/music/search` | `GET /api/music/search` | ✅ 실데이터 (175,569건 중 10건 페이지) |
| 곡 상세 | 우측 곡 상세 패널 | `/api/music/[id]` | `GET /api/music/detail` | ✅ 실데이터 |
| 주변 탐색 (MAP-10) | 하단 `주변 탐색` | `/api/map/nearby/[musicId]` | `/api/music/detail` 의 neighbors | ✅ 실데이터 (10곡) |
| 경로 탐색 (JOURNEY·PATH-01) | 여정 패널 | `/api/journeys/route` | `GET /api/music/journey` | ✅ 실데이터 (2026-09-12 저녁 해소 — 22곡 경로 200 · 1.2~4.0초, A-18) |
| 인증·온보딩 | 로그인·가입·닉네임·튜토리얼 | `/api/auth/**` | 있으나 미연결 | 목 (의도적, A-15·B-17) |
| 플레이리스트 | 목록·상세·생성·곡 추가/삭제/순서 | `/api/playlists/**` | `/api/playlist/**` 8종 **있음** | 목 (프론트 미연결) |
| 주변 사람·팔로우·반응 | 소셜 전반 | `/api/users/**` | 없음 | 목 (A-3·A-4) |
| 레이어별 대표곡(커버) | 지도 커버 | `/api/map/layers/{layer}/representatives` | 없음 | 목 (A-2). **실데이터에서는 무효** — 목이 주는 ID 가 배포 백엔드 곡과 하나도 안 겹쳐(실측 0/40) 커버는 프론트 격자 선별로 폴백된다 |
| 차트·피드·재생 로그 | 각 패널 | 해당 라우트 | 없음 | 목 (A-7) |
| 별자리 배치 (PATH-01) | 여정·플리 별자리 뷰 | `/api/constellations/layout` | **구현됨 (A-9)** — 2026-09-13 BE 회신. 다만 **배포 전** (api-docs 27개 경로에 없음) | 실API 로 전환 완료 (S15P21A405-278). 목 라우트·목 계산·`points` 우회 전부 제거 |

**요약 — 백엔드·인프라에 필요한 것:**

1. **`genreId`·`weight`·`playable` 값 (B-21).** `/api` 정렬이 배포되면서 지도·검색·상세·경로가 전부 살아났고, 이제 남은 건 값이다. 특히 **genreId 를 0 → 무장르(10)** 로 바꾸는 것 (A-1-1 에서 확정, 교체 지점은 `MajorTrackReaderAdapter.genreIdOf` 한 곳).
2. **유저 테스트 동안 조회 API 를 토큰 없이 열기 (A-17).** 로그인을 태우지 않기로 해서 요청한 **임시** 조치다. 읽기 전용만 열고, 테스트가 끝나거나 로그인 실연동이 붙으면 **되돌린다.**
3. `CORS_ALLOWED_ORIGINS` 정상화 (B-17). 지금은 프론트가 서버 프록시로 우회 중이라 급하지는 않지만, 이게 풀려야 로그인을 실연동으로 되돌린다.
4. **별자리 배치 API 배포 (A-9).** 구현은 됐고 프론트도 실API 로 갈아탔는데(S15P21A405-278) **배포 호스트에 아직 없다.** 배포되기 전에는 별자리 뷰가 뜨지 않는다 — 프론트 목을 이미 걷어냈기 때문이다.
5. **곡 검색 응답 시간 (B-23).** 18~20초는 유저 테스트에서 못 쓴다.
6. **플레이리스트 DTO 결정 (0-2 필드 대조).** 백엔드 응답에 좋아요·무드 태그·소유자·`addedAt` 이 없다. 실연동하려면 백엔드가 필드를 채우거나, 기획이 그 화면 요소를 빼기로 정해야 한다. **프론트가 임의로 정할 수 없다.**
7. **없는 대상에 404 (B-24).** 지금은 500 이라 "없음"과 "장애"를 구분할 수 없다.

---

## 0-2. 배포 api-docs 전수 대조 (2026-09-12)

`https://j15a405.p.ssafy.io/api/v3/api-docs` 를 받아 **27개 경로와 DTO 전부**를 프론트 타입·라우트와
맞춰 본 결과다. 지금까지는 "경로가 있다/없다" 수준으로만 적혀 있었는데, 실제로 어긋나는 건 **필드**다.

### 경로 대조

| 백엔드 경로 | 프론트가 부르는 곳 | 상태 |
| --- | --- | --- |
| `GET /api/music/major` | `/api/map/songs` 라우트 | ✅ **일치.** `MajorResponse.content: MapPoint[]` 그대로 받는다. `level` 은 optional, 나머지 `pc{k}min/max` 는 백엔드가 `params: Map<String,String>` 으로 싸잡아 받는다 |
| `GET /api/music/detail?id=` | `/api/music/[id]` 라우트 | ✅ **일치** (`MusicDetailResponse` + `neighbors`) |
| `GET /api/music/search?query=&page=` | `/api/music/search` 라우트 | ✅ **일치.** `PageResponseMusicSummary {content, page, size, hasNext}` — `page` 는 **required** 다 |
| `GET /api/music/journey?start=&end=` | `/api/journeys/route` 라우트 | ✅ **일치.** `JourneyStop` 에 `location`(pc1~16)이 **있다** — 별자리 배치가 여기에 기댄다 (S15P21A405-264) |
| `GET /api/users/nickname-available?nickname=` | `/api/users/nickname-available` 목 | ⚠️ **경로·응답이 똑같다.** 목이 `{available}` 로 모양까지 맞춰 뒀다. 로그인 실연동 때 `live-api-paths.ts` 에 넣기만 하면 된다 |
| `GET /api/user/detail?email=` | `/api/users/{email}` 목 | ⚠️ **모양이 다르다.** 아래 필드 대조 참고 |
| `PATCH /api/user/profile` · `PATCH /api/user/tutorial-completed` | 목 (`/api/auth/nickname`, `/api/auth/tutorial/complete`) | ⚠️ 경로가 다르다. A-13 대로 실연동 때 바꾼다 |
| `POST /api/auth/{signup,login,login/google,exchange,reissue,logout,withdraw}` | 전부 목 | ⚠️ **의도적 목** (A-17 — 유저 테스트에서 로그인을 태우지 않는다) |
| `POST /api/playlist/create` · `PATCH /api/playlist/update` · `DELETE /api/playlist/delete/{id}` · `GET /api/playlist/detail?playlistId=` · `GET /api/playlist/search?email=` · `POST /api/playlist/music/{insert,delete,reorder}` | `/api/playlists/**` 목 8종 | ❌ **경로도 모양도 다르다.** 아래 필드 대조 참고 |
| `GET /api/hello` · `/api/test` · `/api/test/neo4j` · `/api/test/redis` | — | 확인용 엔드포인트. 프론트는 쓰지 않는다 |

**백엔드에 아예 없는 것** (프론트는 목으로 돈다): 본인 조회(A-15), 주변 사용자·팔로우·반응(A-3·A-4),
레이어별 대표곡(A-2), 별자리 배치(A-9), 재생 로그(A-7), 차트, 플레이리스트 좋아요.

### 필드 대조 — 플레이리스트 (가장 크게 어긋난다)

| 프론트 `PlaylistDetail` | 백엔드 `PlaylistDetailResponse` |
| --- | --- |
| `id` | `playlistId` (이름만 다름) |
| `playlistName` | `playlistName` |
| `itemCount` | `musicCnt` (이름만 다름) |
| `totalDuration` | `totalDuration` |
| `items: [{playlistId, musicId, addedAt, music}]` | `musics: MusicDetail[]` — **`addedAt` 이 없다** |
| `email` (소유자) | **없음** |
| `ownerNickname` | **없음** |
| `likeCnt` · `isLiked` | **없음** |
| `moodTags` | **없음** |
| `createdAt` · `updatedAt` | **없음** (목록용 `PlaylistSummary` 에만 `createdAt` 이 있다) |

곡 추가·삭제도 모양이 다르다. 프론트는 `POST /api/playlists/{id}/items` 에 곡 하나,
`DELETE .../items/{musicId}` 로 하나씩 지우는데, 백엔드는 **둘 다 POST 에 `musicIdList` 배열**이다
(`/api/playlist/music/insert`, `/api/playlist/music/delete`). 순서 변경(`/music/reorder`)은 **백엔드에만** 있다.

**2026-09-13 — 상세 조회만 먼저 실연동했다 (S15P21A405-214).** `GET /bff/playlists/{id}` 가 `GET /api/playlist/detail?playlistId=`
를 대신 부르고, 백엔드에 없는 필드는 **지어내지 않고 비운다** — `email`·`createdAt`·`updatedAt`·`addedAt` 은 null,
`ownerNickname` null, `moodTags` 빈 배열, `likeCnt` null·`isLiked` false. 소유자가 없어 `isMine` 은 늘 false 다(편집 UI 안 뜸).
`musics[].location`(pc1~pc16) 은 `Music.location` 으로 옮겨 별자리 좌표로 쓴다 — 플리 패널이 이제 좌표까지 넘긴다.
목록(`/bff/playlists`, `mine`, `liked`)·생성·수정·삭제·곡 추가/삭제는 **아직 목**이다 (`search?email=` 은 로그인 실연동 뒤에야 내 이메일이 있다).

**그래서 나머지를 실연동하면 화면이 깨진다** — 피드의 `좋아요한 플리`, 플리 상세의 무드 태그 3개,
`만든 사람` 표시가 전부 받을 데이터가 없다. 이건 FEATURES 의 PATH-06·유저플로우 13·14 항목이라
**프론트가 임의로 뺄 수 없다.** 팀 결정이 필요하다 (아래 요약 6번).

### 필드 대조 — 유저

| 프론트 `User` | 백엔드 `UserDetailResponse` |
| --- | --- |
| `email` `name` `nickname` `isPublic` `tutorialCompleted` `lastActiveAt` `createdAt` `imageUrl` | 전부 있음 ✅ |
| `updatedAt` | **없음** |
| — | `followerCnt` · `followingCnt` · `isFollowing` · `isMe` 가 **추가로 온다** (피드가 필요로 하던 값이다) |

### 실호출로 확인한 것

```
GET /api/users/nickname-available?nickname=test123   200  {"available":true}
GET /api/user/detail?email=<없는 이메일>              500  INTERNAL_SERVER_ERROR
GET /api/playlist/search?email=<없는 이메일>          500  INTERNAL_SERVER_ERROR
GET /api/playlist/detail?playlistId=1                500  INTERNAL_SERVER_ERROR
```

인증에는 막히지 않는다(A-17). 다만 **없는 대상에 500 을 준다** — 404 여야 한다. 프론트는 이걸
"서버가 죽었다"와 구분할 수 없어서 사용자에게 보여줄 메시지를 고를 수 없다. → 아래 B-24.

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
| A-1 | `GET /music/major` (목: `/api/map/songs`) | `level` (1-based) + 누적 범위 `pc{k}min`·`pc{k}max` 를 **level-1 쌍 전부**. level=1 은 파라미터 없음 | `MapPoint[]` = `{ musicId, pc[16], genreId, weight, title, artist, playable }` | **겹마다 그 겹의 상주 집합을 받는다** (2026-09-11 BE 김효정 ↔ FE 윤주하 확정, D15~D19). 프론트가 파고들 때 화면 범위를 누적에 쌓고 떠오르면 버린다 — 서버는 탐색 상태를 갖지 않는다. 레이어 l ↔ level l+1, 평면은 pc(2l+1)·pc(2l+2). **파라미터 표기는 `pc{k}min`·`pc{k}max` 로 확정** (2026-09-12 BE 제안 ↔ FE 확인 — 프론트가 이미 그대로 보내고 있다: `constants/api-endpoints.ts` `map.songs`) | ✅ 반영됨 (2026-09-12 배포 확인 — 응답 원소는 `MusicSummary` 가 아니라 **`MapPoint`** 다) |
| A-1-1 | `MapPoint.genreId` | — | 장르를 모르는 곡은 **무장르 인덱스(10)** 로 내려준다. 음수 금지 | 실데이터는 662만 중 6.6만(1.0%)만 장르가 있다. 0 으로 채우면 지도가 전부 "앰비언트" 색이 된다. 프론트는 `GENRE_NAMES[10] = "무장르"` · `GENRE_COLORS[10] = rgb(126,138,158)` 회청색을 쓰고, 백엔드 응답에 genreId 가 없을 때의 fallback 도 10 이다 (`lib/backend.ts` `toMapPoint`). **2026-09-12 BE 문의 ↔ FE 확정.** 멜론 코드 29종 → 10색 대응표는 **보류** (A-1-2) | 확정 (프론트 반영 완료 · **배포는 아직 0** → 백엔드 `genreIdOf` 교체 대기) |
| A-1-2 | 장르 체계 (멜론 대분류 29종 ↔ FE `GENRE_NAMES` 10종) | — | 29종을 10종으로 접는 표, 또는 `GENRE_NAMES` 를 29종으로 늘리기 | 두 체계가 서로 다르다 — 멜론은 록/메탈을 한 코드로 묶는데 FE 는 `록`·`메탈` 이 따로고, 멜론의 발라드·댄스·트로트·OST·국악·인디에 대응하는 FE 항목이 없다. **어느 쪽에 맞출지 정해지지 않아 보류** (2026-09-12). 그동안 장르가 붙은 1.0% 도 무장르(10)로 내려도 지도는 깨지지 않는다 | **보류** (팀 결정 대기) |
| A-2 | `GET /api/map/layers/{layer}/representatives` | layer | `{ layer, musicIds[] }` | 레이어마다 **다른 대표곡**을 앨범 커버로 띄운다. 선별 기준은 백엔드가 정함 | 협의 전 |
| A-3 | `GET /api/users/nearby?layer={n}` | layer | `NearbyUser[]` | 지금 있는 **영역(레이어)의 사용자만** 내려줘야 한다. 레이어마다 다른 사람이 보임 (SOCIAL-01) | 협의 전 |
| A-4 | `NearbyUser` 응답 | — | `viewingMusicId` **추가 필요** | 따라가기 시 좌표 두 개가 필요하다: `musicId`=재생 중(우주선 위치), `viewingMusicId`=인솔자가 보고 있는 상세 곡(뷰포트·우측 패널 기준) (SOCIAL-07) | 협의 전 |
| A-5 | `GET /api/music/journey?start=&end=` | 두 곡 ID | `{musicCnt, totalDuration, path:[{step, …MusicDetail}]}` | **16차원 임베딩 거리 기준** 경로 (PATH-01). 프론트가 기대하던 `/api/journeys/route` + `JourneyRoute` 와 경로·형태가 다르다. **`path[].location`(pc1~16) 이 반드시 채워져 있어야 한다** — 경로 곡은 지도 상주 집합 밖일 수 있어서 프론트가 좌표를 알 길이 이것뿐이고, 비면 별자리(PATH-01)가 그려지지 않는다 (S15P21A405-264) | ✅ 구현·도달 가능 · 프론트가 훅에서 변환해 반영 완료 (2026-09-12) |
| A-6 | `GET /api/map/nearby/{musicId}` | musicId | `{ center, neighbors[10] }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10) | 협의 전 |
| A-8 | ~~`GET /api/music/{id}/representative-layers`~~ | — | — | **철회 — 만들지 않아도 된다.** 검색 결과를 누르면 그 곡이 대표곡인 첫 레이어로 자동 전환하려던 것이었는데, **SEARCH-01 이 v1.4 에서 바뀌어** 그 전환을 없애고 고스트별(MAP-12)로 대체했다. 프론트에 남아 있던 훅·목 라우트는 아무데서도 안 쓰여 삭제했다 (S15P21A405-269) | ❌ 철회 (2026-09-12) |
| A-7 | `POST /api/music/{id}/play` | `{ source, playedMs }` | ok | 재생 로그 (`play_history`). `source` 값은 `MAP` / `JOURNEY` / `PLAYLIST` / `FOLLOW` | 협의 전 |
| A-10 | `POST /api/auth/signup` | `{ email, password, nickname }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 가입 (AUTH-01) | ✅ 구현됨 (backend/dev, S15P21A405-121) · 프론트 반영 완료 |
| A-11 | `POST /api/auth/login` | `{ email, password }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 로그인 (AUTH-02) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-12 | `GET /api/users/nickname-available?nickname=` | nickname | `{ available }` | 닉네임 중복 확인 (AUTH-01) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-13 | `PATCH /api/user/profile` | `{ nickname?, imageUrl? }` | `{ nickname, imageUrl }` | **구글 신규 사용자의 닉네임 저장.** 전용 `/api/auth/nickname` 대신 프로필 부분 수정 API 로 해결됐다 (S15P21A405-216). 넘기지 않은 필드는 기존 값 유지 | ✅ 구현·도달 가능 · 프론트 반영 완료, 목 라우트 삭제 (2026-09-12) |
| A-14 | 신규 가입 여부 판단 | — | 본인 조회 응답의 `nickname` 이 null 이면 신규로 본다 | 프론트는 닉네임이 비어 있으면 닉네임 설정 화면으로 보낸다. exchange 응답만으로는 신규를 알 수 없어서 본인 조회(A-15)로 판단한다 | A-15 로 대체 |
| A-15 | **본인 조회 API** | 없음 (Bearer 토큰) | `User` (email, nickname, isPublic, tutorialCompleted, imageUrl …) | 프론트는 `GET /api/auth/me` 를 쓰는데 **백엔드에 없다.** `GET /user/detail?email=` 은 이메일을 파라미터로 요구하지만, 로그인 직후 프론트는 JWT 안의 이메일을 모른다(디코딩하지 않는다). 토큰 주체 기준으로 본인을 돌려주는 엔드포인트가 필요하다. **2026-09-12 api-docs 전수 확인 — 27개 경로에 여전히 없다.** `GET /api/user/detail` 은 `email` 을 required 로 받는다 | 협의 전 (**필요**) |
| A-16 | `/user/detail` 경로 접두 | — | — | **해소됨.** 배포본이 `/api/user/detail?email=` 로 정렬됐고 2026-09-12 실호출로 도달을 확인했다 (없는 이메일에 500 을 주는 건 별건 — B-24) | ✅ 해소 (2026-09-12) |
| A-9 | `POST /api/constellations/layout` | `{ musicIds: number[] }` (최대 30) | `{ points: [{ musicId, x, y }] }` — `x`, `y` 는 `-1 ~ 1` 정규화 좌표 | **별자리 오버레이의 모양** (PATH-01). 16차원 좌표를 2D로 압축한 고정 배치다. 레이어와 무관하게 **같은 곡 집합이면 항상 같은 모양**이어야 한다 — 플리 모양(예: 강아지)이 상품이 되려면 모양이 고정·재현 가능해야 하고, 나중에 "누가 만든 모양"으로 저장·거래하려면 서버에 있어야 한다. 클라이언트 MDS 로도 계산은 되지만 그러면 모양이 클라이언트 구현에 종속된다. **2026-09-12 — 아직 없어서 프론트 목이 계산 중이고, 그 목이 여정 별자리를 한 점으로 뭉개고 있었다 (S15P21A405-264).** 목은 좌표를 `mocks/songs.ts` 에서 찾는데 여정 경로 곡은 **배포 백엔드에서 오는 곡**이라 목이 모른다 — 좌표가 전부 0 으로 채워져 22곡이 `{x:0, y:0}` 한 점에 겹쳤다. **임시 조치:** 프론트가 아는 16차원 좌표를 `points: [{musicId, pc}]` 로 함께 보내고 목이 그걸 쓴다. 백엔드가 이 API 를 구현하면 `points` 는 **무시하면 된다** — 계약은 `musicIds` 만이다. **아직 필요한 이유:** 프론트 계산은 그 화면이 가진 좌표에만 의존하므로 (a) 좌표를 모르는 곡이 섞이면 다시 뭉치고 (b) 여러 사용자가 같은 플리를 같은 모양으로 본다는 보장이 없다 — 플리 모양 거래가 성립하려면 서버 계산이어야 한다 | **구현됨 · 배포 대기 (2026-09-13)**. BE 회신: 본문은 `{musicIds}` (2개 이상 30개 이하, 중복 불가), 응답은 `{points:[{musicId,x,y}]}` — 프론트 목과 같은 모양이라 `types/constellation.ts` 는 그대로 쓴다. **`points` 는 이제 보내도 무시된다.** 프론트는 S15P21A405-278 에서 목 라우트(`app/bff/constellations/layout`)·목 계산(`mocks/constellation.ts`)·`points` 우회를 전부 지우고 `live-api-paths.ts` 로 흘려보낸다. **남은 것은 배포뿐** — 2026-09-13 실호출 시 `/api/v3/api-docs` 27개 경로에 constellation 이 없고 POST 는 500(미매핑 경로와 같은 응답)이다. 프론트 MR 은 배포 확인 뒤 머지한다 |
| A-17 | **유저 테스트 기간 한정 — 조회 API 를 토큰 없이 열어 둔다** | — | — | 유저 테스트에서 **로그인을 태우지 않기로 했다.** 테스트 참가자에게 가입·로그인을 시키면 (a) 지도를 보기도 전에 이탈하고 (b) 실계정·비밀번호가 생겨 뒷정리가 필요하며 (c) 우리가 보려는 건 지도 탐색·주변 탐색·경로 탐색이지 인증 흐름이 아니다. 그런데 지금 백엔드는 `anyRequest().authenticated()` 라 조회 API 가 전부 401 이고, 프론트는 서버 토큰(`BACKEND_ACCESS_TOKEN`)으로 우회 중인데 **그 토큰도 결국 누군가 로그인해서 발급받아야** 한다. 그래서 백엔드에 조회 API 를 한시적으로 열어 달라고 요청했다. 대상은 **읽기 전용**(`/api/music/**` = major·search·detail·journey)이고, 쓰기(플레이리스트 생성·프로필 수정·재생 로그)와 `/api/auth/**` 는 그대로 둔다. **되돌릴 조건:** 유저 테스트 종료 시점. 또는 로그인 실연동(S15P21A405-242 후속)이 붙는 시점 중 **먼저 오는 쪽**. **남는 위험:** 공개 호스트라 그동안 곡 데이터셋이 누구에게나 열린다 — 되돌리기 전에는 발표·운영으로 넘기지 않는다. 프론트 코드는 바뀌지 않는다 (토큰이 있으면 그대로 Bearer 로 붙이고, 없으면 안 붙일 뿐이다). **2026-09-12 배포 확인 — 다만 범위가 요청보다 넓다:** 구현이 `anyRequest().permitAll()` 이라 `/api/playlist/**`(생성·삭제 포함)와 `/api/user/detail` 까지 무인증으로 열렸다. 읽기 전용만 여는 게 원래 요청이었다 | **적용됨 (임시 · 되돌릴 것)**. 2026-09-12 BE 회신으로 **전체 해제가 의도된 범위임을 확인**했고, 되돌리는 시점은 위 정의("유저 테스트 종료 또는 로그인 실연동 중 먼저 오는 쪽")로 합의했다. BE 는 S15P21A405-245 로 추적하며 원복 전 조율한다. **프론트도 같은 창에서 로그인 게이트를 껐다** (S15P21A405-252) — `AuthGuard` 가 토큰 없이 통과시킨다. 되돌릴 때 백엔드 인증과 **함께** 되돌린다: `NEXT_PUBLIC_REQUIRE_LOGIN=1` 또는 `constants/auth.ts` 제거. **같은 창에서 기능 몇 개도 감췄다** (S15P21A405-333, `constants/features.ts`) — 마이페이지 · 플레이리스트 · 주변 사람/따라가기/반응 · 차트. 이번 테스트에서 볼 것이 탐색 · 주변 탐색 · 검색 · 여정 넷이라 나머지 입구를 닫았다. 코드는 지우지 않았고 `NEXT_PUBLIC_FEATURE_{PROFILE,PLAYLIST,SOCIAL,CHART}=1` 로 되돌린다. 원복 시점은 이 항목과 같다 |
| A-18 | **`GET /api/music/journey` 가 항상 500 이다** | `start`·`end` 곡 ID | — | 2026-09-12 BE 회신: 원인은 `JourneyService` 내부가 아니라 **`JourneyPathFinder` 구현체가 없어서**다. `backend/dev` 에도 작업 브랜치에도 구현이 없어 곡 ID 와 무관하게 `pathFinder.orElseThrow(...)` 로 500 이 난다. **S15P21A405-224 로 추적 중이고 빠른 수정이 아니다.** 그동안 여정 경로 탐색(JOURNEY·PATH-01)은 쓸 수 없다 — 목으로 되돌릴 수도 없다(목 곡 ID 가 실제 ID 와 숫자만 겹쳐 엉뚱한 별에 매칭된다). **2026-09-12 저녁 해소 확인 —** 같은 엔드포인트가 200 으로 응답한다. 실측 2건: `start=3725330&end=6321998` 200 · 1,158ms, `start=3725330&end=4803049` 200 · 4,046ms. 22곡짜리 경로가 제목·아티스트·`location` 까지 채워져 돌아왔다 | **해소됨 (2026-09-12 실측)** |
| A-19 | **설문 응답 저장 API** (S15P21A405-250) | `POST /api/feedback` — `{ kind: "nearby"|"transition", musicId, centerMusicId?, rank?, startMusicId?, endMusicId?, prevMusicId?, position?, totalStops?, answers: string[][], anonymousId, surveyVersion, forced, elapsedMs, answeredAt }` | ok | 유저 테스트에서 **곡과 곡 사이의 유사도·전환이 자연스러운지**를 테스터 응답으로 재는 설문이다. 프론트는 목 라우트(`src/app/bff/feedback/route.ts`)로 받아 콘솔에 찍기만 한다 — **응답이 서버에 안 남으면 설문을 돌려도 집계할 것이 없다.** 로그인을 태우지 않으므로(A-17) 사용자 식별은 `anonymousId`(브라우저 localStorage UUID) 뿐이다. `answers` 는 단계별 선택값의 배열이고 **문항·단계가 바뀔 수 있어서 값 목록을 고정 컬럼으로 잡으면 안 된다** — 문자열 배열(또는 JSON)로 저장하고 `surveyVersion` 으로 버전을 구분한다. `elapsedMs` 가 너무 짧은 응답은 대충 찍은 것으로 걸러내는 용도다 | 협의 중 (백엔드 작업하기로 함, 2026-09-12) |
| A-20 | **곡 장르가 비어 있다** | `GET /api/music/detail?id=` · `nearby` · `major` | `genres: []` | 배포 데이터 1,082곡이 **전부** 빈 배열이다 (2026-09-14 실측). 프론트는 장르로 별 색과 앨범 커버 대체색을 칠하는데(`genreColor`), 값이 없으면 전부 `무장르`(id 10) 한 색이 된다 — **지도가 단색이 되고 설문 카드의 두 곡이 같은 색 사각형으로 보인다.** 목 데이터에서는 색이 나뉘어서 이 문제가 안 보였다 | 협의 전 |
| A-21 | **앨범 커버 주소** | — | `albumCoverUrl` 을 `detail`·`nearby`·`journey` 응답에 추가 | 프론트에 자리는 이미 있다(`components/common/album-cover.tsx`) — 값만 오면 곡 상세와 설문 카드가 함께 커버를 그린다. 지금 응답에는 `mbid` 와 `album` 이름이 있는데, `mbid` 를 Cover Art Archive 의 `release`·`release-group` 으로 조회하면 404 다(2026-09-14 실측) — **recording MBID 로 보이므로 recording → release 를 한 번 더 타야 커버에 닿는다.** 프론트에서 곡마다 외부 조회를 하면 요청이 곡 수만큼 늘어서 백엔드가 미리 담아주는 쪽이 맞다 | 협의 전 |
| A-22 | **주변 탐색 이웃에 `duration` 이 없다** | `GET /api/music/nearby?id=` | `neighbors[].duration` 추가 | 설문의 `listened_sec` 은 이제 **실제 재생된 시간**이라(임베드의 재생·정지를 따라간다) `videoId` 가 있는 곡은 끝나면 시계도 멈춘다. 문제는 **`videoId` 가 없는 곡**이다 — 임베드가 안 붙어 재생 여부가 낙관값이라 안 멈추고, 카드를 띄워두거나 탭을 놔두면 곡 길이보다 큰 값이 나온다 (2026-09-14 실측: 이웃 10곡 중 1곡 `1623627` 이 `videoId` 없음). 곡 길이를 알면 거기서 자를 수 있는데 **이웃 응답에 `duration` 이 없다**(현재 키: id·title·artist·album·genres·youtubeUrl·videoId·location·distance). 경로 탐색(`stops[].duration`)에는 있어서 거기만 잘린다. 덤으로 `center` 는 키가 id·title·artist·location 4개뿐이라 장르·앨범도 안 온다 | 협의 전 |

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
