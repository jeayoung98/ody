# 백엔드·ERD 영향 목록 (Frontend → Backend)

프론트 구현 과정에서 나온 **백엔드·ERD 협의 항목**을 모은 문서다.
프론트가 임의로 정할 수 없는 것들이며, 목(mock) API로 임시 구현해둔 것도 전부 여기에 적는다.

- 상태: `협의 전` / `협의 중` / `반영됨`
- 최종 수정: 2026-09-16

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
| `PATCH /api/user/nickname` · `PATCH /api/user/image` · `PATCH /api/user/tutorial-completed` | 실연동 | ✅ 2026-09-18 반영. `/api/user/profile` 은 배포 스펙에서 사라졌다 (A-13) |
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
| E-5 | `music` | 곡 상세에 필요한 필드가 ERD에 없음: 앨범 커버 URL, 발매 국가, 언어, 작곡가, 작사가, 무드 태그 | 곡 상세 패널 구성 항목 (SONG-02, 유저 플로우) | 상세 화면의 절반이 빈칸 | 일부 해소 — 앨범 커버는 `music.album_mbid` 로 대체했다(A-47). 나머지는 협의 전 |
| E-6 | `user` | `nickname` 에 **UNIQUE 제약 + NOT NULL**. 길이 2~20자 검증 | 가입 직후 닉네임을 직접 받고 **중복을 허용하지 않는다** (AUTH-01, 2026-09-10 기획 확정). 지금은 `VARCHAR(100) NULL` 로 중복이 들어간다 | 같은 닉네임이 여러 개 생겨 프로필·따라가기에서 사람을 구분할 수 없다 | 협의 전 |
| E-7 | `user` | 비밀번호 해시 컬럼 추가(예: `password_hash VARCHAR(255) NULL`) + **PK 정책 재검토** | 이메일·비밀번호 가입이 확정됐다 (AUTH-01). 현재 PK 는 "구글 계정 이메일"이라 소셜 가입만 전제한다 | 이메일 가입 자체가 불가능 | 협의 전 |
| E-8 | `music_like` 테이블 신규 | PK `(email, music_id)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `user`·`music` FK, `(email, created_at DESC, music_id DESC)` 인덱스. DDL: `backend/src/main/resources/db/music_like_001_table.sql` | 곡 단위 좋아요(MUSIC-LIKE). 좋아요 목록은 **가상 플레이리스트**라 `playlist`/`playlist_item` 레코드를 만들지 않는다 | 곡 좋아요와 마이페이지 좋아요 목록 전부 불가 | ✅ **운영 적용 완료** (2026-09-22 14:13 KST, Backend 가 직접 적용). PK·FK 2개·정렬 인덱스 생성 확인 (S15P21A405-512) |
| E-9 | `taste_analysis` 테이블 신규 | `(email, analysis_date)` 단위 생성 이력 + snapshot hash·버전·결과 JSON·lease. PENDING 사용자별 partial unique index와 최신 SUCCESS 조회 인덱스 포함. DDL: `backend/src/main/resources/db/taste_analysis_001_table.sql` | AI 취향 리포트의 1일 1회 제한, 동시 생성 배제, snapshot 재사용, stale 판정의 저장소 | 취향 분석 API 전체 불가 | ✅ **운영 적용 완료** (2026-09-22 14:13 KST, Backend 가 직접 적용). PENDING partial unique index·최신 SUCCESS 인덱스·CHECK 3개 생성 확인 (S15P21A405-512) |

---

## 2. 신규 API / 응답 변경

| # | API | 요청 | 응답 | 이유 | 상태 |
| --- | --- | --- | --- | --- | --- |
| A-1 | `GET /music/major` (목: `/api/map/songs`) | `level` (1-based) + 누적 범위 `pc{k}min`·`pc{k}max` 를 **level-1 쌍 전부**. level=1 은 파라미터 없음 | `MapPoint[]` = `{ musicId, pc[16], genreId, weight, title, artist, playable }` | **겹마다 그 겹의 상주 집합을 받는다** (2026-09-11 BE 김효정 ↔ FE 윤주하 확정, D15~D19). 프론트가 파고들 때 화면 범위를 누적에 쌓고 떠오르면 버린다 — 서버는 탐색 상태를 갖지 않는다. 레이어 l ↔ level l+1, 평면은 pc(2l+1)·pc(2l+2). **파라미터 표기는 `pc{k}min`·`pc{k}max` 로 확정** (2026-09-12 BE 제안 ↔ FE 확인 — 프론트가 이미 그대로 보내고 있다: `constants/api-endpoints.ts` `map.songs`) | ✅ 반영됨 (2026-09-12 배포 확인 — 응답 원소는 `MusicSummary` 가 아니라 **`MapPoint`** 다) |
| A-1-1 | `MapPoint.genreId` | — | 장르를 모르는 곡은 **무장르 인덱스(10)** 로 내려준다. 음수 금지 | 실데이터는 662만 중 6.6만(1.0%)만 장르가 있다. 0 으로 채우면 지도가 전부 "앰비언트" 색이 된다. 프론트는 `GENRE_NAMES[10] = "무장르"` · `GENRE_COLORS[10] = rgb(126,138,158)` 회청색을 쓰고, 백엔드 응답에 genreId 가 없을 때의 fallback 도 10 이다 (`lib/backend.ts` `toMapPoint`). **2026-09-12 BE 문의 ↔ FE 확정.** 멜론 코드 29종 → 10색 대응표는 **보류** (A-1-2) | 확정 (프론트 반영 완료 · **배포는 아직 0** → 백엔드 `genreIdOf` 교체 대기) |
| A-1-2 | 장르 체계 (멜론 대분류 29종 ↔ FE `GENRE_NAMES` 10종) | — | 29종을 10종으로 접는 표, 또는 `GENRE_NAMES` 를 29종으로 늘리기 | 두 체계가 서로 다르다 — 멜론은 록/메탈을 한 코드로 묶는데 FE 는 `록`·`메탈` 이 따로고, 멜론의 발라드·댄스·트로트·OST·국악·인디에 대응하는 FE 항목이 없다. **어느 쪽에 맞출지 정해지지 않아 보류** (2026-09-12). 그동안 장르가 붙은 1.0% 도 무장르(10)로 내려도 지도는 깨지지 않는다 | **보류** (팀 결정 대기) |
| A-1-3 | `MapPoint.videoId` (`GET /music/major`) | — | 지도 응답의 `videoId` 를 **상세와 같이 채워 줄 것** | 응답에 필드는 있는데 **1,071곡 전부 null** 이다 (2026-09-14 실호출). 같은 곡을 `GET /api/music/detail?id=` 로 부르면 값이 온다 — 표본 30곡 중 16곡(53%). 재생은 상세를 부르므로 지금 동작에 문제는 없다. 다만 **지도에서 "이 곡은 사이트에서 들린다" 를 미리 보여줄 수가 없다** — 지금 `playable` 은 검색 URL 유무라서 임베드 가능 여부와 다르다 | 협의 전 |
| A-2 | `GET /api/map/layers/{layer}/representatives` | layer | `{ layer, musicIds[] }` | 레이어마다 **다른 대표곡**을 앨범 커버로 띄운다. 선별 기준은 백엔드가 정함 | 협의 전 |
| A-3 | ~~`GET /api/users/nearby?layer={n}`~~ → **`GET /api/realtime/layers/{layer}/users`** | `layer` (0-based, 경로) | `{ layer, groups[] }` — `groups` 모양이 소켓 `VIEWPORT_SNAPSHOT` 의 것과 같다 | 지금 있는 **영역(레이어)의 사용자만** 내려줘야 한다 (SOCIAL-01). 경로·응답이 요청과 다르게 구현됐다 | ✅ **구현·연동 완료** (백엔드 S15P21A405-533 / 프론트 S15P21A405-537, 2026-09-22). 상세는 아래 §6 |
| A-4 | `NearbyUser` 응답 | — | `viewingMusicId` **추가 필요** | 따라가기 시 좌표 두 개가 필요하다: `musicId`=재생 중(우주선 위치), `viewingMusicId`=인솔자가 보고 있는 상세 곡(뷰포트·우측 패널 기준) (SOCIAL-07) | 협의 전 |
| A-5 | `GET /api/music/journey?start=&end=` | 두 곡 ID | `{musicCnt, totalDuration, path:[{step, …MusicDetail}]}` | **16차원 임베딩 거리 기준** 경로 (PATH-01). 프론트가 기대하던 `/api/journeys/route` + `JourneyRoute` 와 경로·형태가 다르다. **`path[].location`(pc1~16) 이 반드시 채워져 있어야 한다** — 경로 곡은 지도 상주 집합 밖일 수 있어서 프론트가 좌표를 알 길이 이것뿐이고, 비면 별자리(PATH-01)가 그려지지 않는다 (S15P21A405-264) | ✅ 구현·도달 가능 · 프론트가 훅에서 변환해 반영 완료 (2026-09-12) |
| A-6 | `GET /api/map/nearby/{musicId}` | musicId | `{ center, neighbors[10] }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10) | 협의 전 |
| A-8 | ~~`GET /api/music/{id}/representative-layers`~~ | — | — | **철회 — 만들지 않아도 된다.** 검색 결과를 누르면 그 곡이 대표곡인 첫 레이어로 자동 전환하려던 것이었는데, **SEARCH-01 이 v1.4 에서 바뀌어** 그 전환을 없애고 고스트별(MAP-12)로 대체했다. 프론트에 남아 있던 훅·목 라우트는 아무데서도 안 쓰여 삭제했다 (S15P21A405-269) | ❌ 철회 (2026-09-12) |
| A-5 | **`GET /api/music/journey?start=&end=`** | 두 곡 ID | `{ musicCnt, totalDuration, path[] }` — **`musicCnt` 2~20, 중앙값 6** | **16차원 임베딩 거리 기준**으로 경로를 뽑아야 한다. 2D 평면 직선으로 뽑으면 레이어 0에서 일직선이 되어 별자리 모양이 안 나온다 (PATH-01) | ✅ 구현됨 (S15P21A405-61) · **2026-09-13 곡 수 개정(007/286)** — 아래 참조 |
| A-6 | ~~`GET /api/map/nearby/{musicId}`~~ → **`GET /api/music/nearby`** | `id` | `{ center, neighbors[], lowSimilarity }` | 주변 탐색. 유사도는 16차원 거리 기준 (MAP-10). **경로 폐기** — `map/nearby/{musicId}` 는 좌표 기준 탐색을 표현할 수 없다. 계약은 api-spec §3.5 | ✅ 구현됨 (S15P21A405-59) · 이름은 BE3·팀 협의 중(`/music/neighbors` 와 구분 필요) |
| A-8 | `GET /api/music/{id}/representative-layers` | musicId | `{ musicId, layers: number[] }` (오름차순) | 검색 결과를 누르면 그 곡이 **대표곡으로 노출되는 첫 레이어**로 이동해야 한다. 한 곡이 여러 레이어에서 대표곡일 수 있다. 클라이언트가 8개 레이어 대표곡을 전부 들고 있을 수 없으므로 서버가 계산해야 한다 (SEARCH-01) | 협의 전 |
| A-7 | `POST /api/music/{id}/play` | `{ source, playedMs }` | ok | 재생 로그 (`play_history`). `source` 값은 `MAP` / `JOURNEY` / `PLAYLIST` / `FOLLOW` | 협의 전 |
| A-28 | `POST /api/music/report` | `{ musicId, reason, detailReason? }` | `{ reportId }` | **곡 신고 (S15P21A405-377 · 394). ✅ 배포됨 — 프론트 실연동 완료 (2026-09-17).** 배포 스웨거(`/api/v3/api-docs`) 기준 계약: `reason` 은 `spoken`(말소리) / `noise`(잡음) / `other`(기타) 셋이고 **프론트가 처음부터 쓰던 값 그대로**다. `detailReason` 은 선택이고 2000자 제한 — 프론트는 `기타` 를 고를 때만 입력칸을 열고 비어 있으면 못 보내게 막는다. **곡이 경로가 아니라 본문으로 간다** — 프론트 경로는 `/bff/music/{id}/report` 그대로 두고 BFF 라우트가 옮겨 담는다. 실호출 확인: `reportId` 1·2·3 발급, 잘못된 `reason` 은 BFF 에서 400. **남은 것 — 사람 식별자.** 본문에 `anonymousId` 가 없어서 같은 사람이 같은 곡을 몇 번이든 신고할 수 있다 (아래 "곡 신고 테이블" 의 중복 방지 인덱스가 못 걸린다). 비로그인 배포가 끝날 때까지는 집계에서 걸러야 한다 | ✅ 반영됨 (2026-09-17 실연동 확인) · 사람 식별자는 미해결 |
| A-30 | `POST /api/music/report` 의 `reason` 에 **`unplayable` 을 더해 달라** | `{ …, reason: "unplayable" }` | — | **음원을 못 찾아 재생 자체가 안 되는 곡 (S15P21A405-397).** 기존 셋(`spoken`·`noise`·`other`)은 "이건 곡이 아니다" 라는 사람의 판단인데, 재생 불가는 그 축이 아니라 **들을 수가 없다**는 사실이라 고를 자리가 없었다. 프론트는 `usePlayability` 가 `notFound` 로 판정한 곡(= `POST /api/music/videoid` 가 `"none"` 을 준 곡)에서만 이 항목을 띄운다 — 아직 안 찾아본 곡·조회 실패는 제외한다. **두 곳을 늘려야 한다**: `MusicReportRequest.reason` 패턴 `spoken|noise|other|unplayable`, 그리고 `music_report_reason_chk` CHECK. **프론트는 이미 이 값을 보낸다** — 반영 전까지 이 사유로 낸 신고는 400 이고 사용자에게 실패 토스트가 뜬다(조용히 사라지지 않는다). **함께 물어봄:** `videoid` 조회가 `none` 을 낸 결과를 서버가 저장하는가? 저장한다면 이 신고는 사람이 실제로 부딪혔다는 신호로만 쓰고, 저장하지 않는다면 저장을 추가하는 쪽이 신고보다 빠짐없이 모인다 | 협의 중 (2026-09-17 요청, **FE 선반영**) |
| A-31 | `music_report` 의 **reason CHECK 제약이 안 풀렸다** | `reason: "unplayable"` · `"mistitled"` | 500 `INTERNAL_ERROR` | **스웨거 패턴만 풀렸고 DB 제약은 그대로다** (2026-09-17 실측). `MusicReportRequest.reason` 은 `{"type":"string"}` 으로 바뀜어 요청은 통과하는데, INSERT 가 CHECK 에 걸려 500 이 난다. 배포 백엔드로 직접 쌓은 결과: `noise`/`spoken`/`other` → 200 (reportId 11·12·13), `unplayable`/`mistitled` → **500**. **`unplayable` 은 이미 `frontend/dev` 에 머지돼 있어서 지금 배포하면 그 사유로 낸 신고가 전부 실패한다.** 필요한 조치: `ALTER TABLE music_report DROP CONSTRAINT music_report_reason_chk;` 또는 `CHECK (reason IN ('spoken','noise','other','unplayable','mistitled'))` 로 교체. 값을 프론트가 정하기로 했으므로 **제약을 아예 빼는 쪽이 낫다** — 사유가 늘 때마다 DB 마이그레이션을 기다리지 않아도 된다 | 요청됨 (2026-09-17 실측 후) |
| A-32 | `GET /api/music/search` 의 **제목 단독 조건 직접 지원** (선택 최적화, S15P21A405-411) | `music=Love&page=0` | 기존 페이지 응답 | 기능 구현에 필수인 변경은 아니다. 제목 칩을 만든 직후 프론트 BFF 가 기존 `query=Love` 통합 검색을 최대 5페이지 조회하고 제목 앞일치만 남기므로 현재 백엔드 그대로 동작한다. 다만 `music` 단독을 직접 처리하면 최대 5페이지 밖 결과가 빠질 가능성과 BFF의 반복 호출을 없앨 수 있다. 반영 시 BFF 우회만 제거하면 된다 | 선택 개선 (FE 기능 구현 완료) |
| A-29 | `POST /api/feedback` 의 `reason` 에 **`compare` 를 더해 달라** | `{ …, reason: "compare" }` | — | **곡 신고와 다른 건이다 (S15P21A405-380).** 부정 응답 이유 넷(`dup`·`mood`·`tempo`·`spoken`)은 모두 **방금 들은 곡**에 대한 판단인데, 이상한 쪽이 **비교 상대**(주변=기준곡, 여정=앞 곡)일 때 말할 자리가 없다. 그러면 사용자가 엉뚱한 이유를 골라, 지표에서 "알고리즘이 고른 연결이 나쁘다" 로 읽힌다. **프론트는 이미 이 값을 보낸다** — CHECK 제약을 늘려 주기 전까지 이 이유로 낸 응답은 거부된다 (조용히 사라지지는 않고 카드에 재시도·포기로 드러난다). 자세한 것은 아래 "설문 이유 `compare` 추가" 참고 | 협의 전 |
| A-10 | `POST /api/auth/signup` | `{ email, password, nickname }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 가입 (AUTH-01) | ✅ 구현됨 (backend/dev, S15P21A405-121) · 프론트 반영 완료 |
| A-11 | `POST /api/auth/login` | `{ email, password }` | `{ accessToken }` + refresh 쿠키 | 이메일·비밀번호 로그인 (AUTH-02) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-12 | `GET /api/users/nickname-available?nickname=` | nickname | `{ available }` | 닉네임 중복 확인 (AUTH-01) | ✅ 구현됨 (backend/dev) · 프론트 반영 완료 |
| A-13 | ~~`PATCH /api/user/profile`~~ → `PATCH /api/user/nickname` |  `{ nickname }` | `{ nickname }` | **구글 신규 사용자의 닉네임 저장.** 전용 `/api/auth/nickname` 대신 프로필 부분 수정 API 로 해결됐었다 (S15P21A405-216). **2026-09-18 배포 스펙에 `/api/user/profile` 이 없다** — S15P21A405-426 에서 닉네임(`PATCH /api/user/nickname`, JSON)과 이미지(`PATCH /api/user/image`, multipart)로 갈렸다. 프론트도 BFF 라우트를 둘로 나눠 따라갔다 | ✅ 해소 (2026-09-18) · 프론트 반영 완료 (S15P21A405-474) |
| A-14 | 신규 가입 여부 판단 | — | 본인 조회 응답의 `nickname` 이 null 이면 신규로 본다 | 프론트는 닉네임이 비어 있으면 닉네임 설정 화면으로 보낸다. exchange 응답만으로는 신규를 알 수 없어서 본인 조회(A-15)로 판단한다 | A-15 로 대체 |
| A-15 | **본인 조회 API** | 없음 (Bearer 토큰) | `User` (email, nickname, isPublic, tutorialCompleted, imageUrl …) | 프론트는 `GET /api/auth/me` 를 쓰는데 **백엔드에 없다.** `GET /user/detail?email=` 은 이메일을 파라미터로 요구하지만, 로그인 직후 프론트는 JWT 안의 이메일을 모른다(디코딩하지 않는다). 토큰 주체 기준으로 본인을 돌려주는 엔드포인트가 필요하다. **2026-09-12 api-docs 전수 확인 — 27개 경로에 여전히 없다.** `GET /api/user/detail` 은 `email` 을 required 로 받는다. **2026-09-18 에도 없다(34개 경로).** 프론트는 우회로 넘어갔다 (S15P21A405-462): 액세스 토큰의 JWT `sub` 가 이메일이라(실측 확인) BFF 라우트가 그 값을 꺼내 `GET /api/user/detail?email=` 을 대신 부른다. 서명은 검증하지 않는다 — 위조 토큰은 그 요청을 받은 백엔드가 거절한다. **여전히 본인 조회 API 가 있는 편이 낫다**: 토큰 클레임 모양이 바뀌면 프론트가 조용히 깨지고, 지금은 본인 조회 한 번에 왕복이 두 번이다 | 협의 전 (**필요**) · FE 는 JWT sub 우회로 동작 중 (2026-09-18) |
| A-16 | `/user/detail` 경로 접두 | — | — | **해소됨.** 배포본이 `/api/user/detail?email=` 로 정렬됐고 2026-09-12 실호출로 도달을 확인했다 (없는 이메일에 500 을 주는 건 별건 — B-24) | ✅ 해소 (2026-09-12) |
| A-9 | `POST /api/constellations/layout` | `{ musicIds: number[] }` (최대 30) | `{ points: [{ musicId, x, y }] }` — `x`, `y` 는 `-1 ~ 1` 정규화 좌표 | **별자리 오버레이의 모양** (PATH-01). 16차원 좌표를 2D로 압축한 고정 배치다. 레이어와 무관하게 **같은 곡 집합이면 항상 같은 모양**이어야 한다 — 플리 모양(예: 강아지)이 상품이 되려면 모양이 고정·재현 가능해야 하고, 나중에 "누가 만든 모양"으로 저장·거래하려면 서버에 있어야 한다. 클라이언트 MDS 로도 계산은 되지만 그러면 모양이 클라이언트 구현에 종속된다. **2026-09-12 — 아직 없어서 프론트 목이 계산 중이고, 그 목이 여정 별자리를 한 점으로 뭉개고 있었다 (S15P21A405-264).** 목은 좌표를 `mocks/songs.ts` 에서 찾는데 여정 경로 곡은 **배포 백엔드에서 오는 곡**이라 목이 모른다 — 좌표가 전부 0 으로 채워져 22곡이 `{x:0, y:0}` 한 점에 겹쳤다. **임시 조치:** 프론트가 아는 16차원 좌표를 `points: [{musicId, pc}]` 로 함께 보내고 목이 그걸 쓴다. 백엔드가 이 API 를 구현하면 `points` 는 **무시하면 된다** — 계약은 `musicIds` 만이다. **아직 필요한 이유:** 프론트 계산은 그 화면이 가진 좌표에만 의존하므로 (a) 좌표를 모르는 곡이 섞이면 다시 뭉치고 (b) 여러 사용자가 같은 플리를 같은 모양으로 본다는 보장이 없다 — 플리 모양 거래가 성립하려면 서버 계산이어야 한다 | **구현됨 · 배포 대기 (2026-09-13)**. BE 회신: 본문은 `{musicIds}` (2개 이상 30개 이하, 중복 불가), 응답은 `{points:[{musicId,x,y}]}` — 프론트 목과 같은 모양이라 `types/constellation.ts` 는 그대로 쓴다. **`points` 는 이제 보내도 무시된다.** 프론트는 S15P21A405-278 에서 목 라우트(`app/bff/constellations/layout`)·목 계산(`mocks/constellation.ts`)·`points` 우회를 전부 지우고 `live-api-paths.ts` 로 흘려보낸다. **남은 것은 배포뿐** — 2026-09-13 실호출 시 `/api/v3/api-docs` 27개 경로에 constellation 이 없고 POST 는 500(미매핑 경로와 같은 응답)이다. 프론트 MR 은 배포 확인 뒤 머지한다 |
| A-17 | **유저 테스트 기간 한정 — 조회 API 를 토큰 없이 열어 둔다** | — | — | 유저 테스트에서 **로그인을 태우지 않기로 했다.** 테스트 참가자에게 가입·로그인을 시키면 (a) 지도를 보기도 전에 이탈하고 (b) 실계정·비밀번호가 생겨 뒷정리가 필요하며 (c) 우리가 보려는 건 지도 탐색·주변 탐색·경로 탐색이지 인증 흐름이 아니다. 그런데 지금 백엔드는 `anyRequest().authenticated()` 라 조회 API 가 전부 401 이고, 프론트는 서버 토큰(`BACKEND_ACCESS_TOKEN`)으로 우회 중인데 **그 토큰도 결국 누군가 로그인해서 발급받아야** 한다. 그래서 백엔드에 조회 API 를 한시적으로 열어 달라고 요청했다. 대상은 **읽기 전용**(`/api/music/**` = major·search·detail·journey)이고, 쓰기(플레이리스트 생성·프로필 수정·재생 로그)와 `/api/auth/**` 는 그대로 둔다. **되돌릴 조건:** 유저 테스트 종료 시점. 또는 로그인 실연동(S15P21A405-242 후속)이 붙는 시점 중 **먼저 오는 쪽**. **남는 위험:** 공개 호스트라 그동안 곡 데이터셋이 누구에게나 열린다 — 되돌리기 전에는 발표·운영으로 넘기지 않는다. 프론트 코드는 바뀌지 않는다 (토큰이 있으면 그대로 Bearer 로 붙이고, 없으면 안 붙일 뿐이다). **2026-09-12 배포 확인 — 다만 범위가 요청보다 넓다:** 구현이 `anyRequest().permitAll()` 이라 `/api/playlist/**`(생성·삭제 포함)와 `/api/user/detail` 까지 무인증으로 열렸다. 읽기 전용만 여는 게 원래 요청이었다 | **적용됨 (임시 · 되돌릴 것)**. 2026-09-12 BE 회신으로 **전체 해제가 의도된 범위임을 확인**했고, 되돌리는 시점은 위 정의("유저 테스트 종료 또는 로그인 실연동 중 먼저 오는 쪽")로 합의했다. BE 는 S15P21A405-245 로 추적하며 원복 전 조율한다. **프론트도 같은 창에서 로그인 게이트를 껐다** (S15P21A405-252) — `AuthGuard` 가 토큰 없이 통과시킨다. 되돌릴 때 백엔드 인증과 **함께** 되돌린다: `NEXT_PUBLIC_REQUIRE_LOGIN=1` 또는 `constants/auth.ts` 제거. **같은 창에서 기능 몇 개도 감췄다** (S15P21A405-333, `constants/features.ts`) — 마이페이지 · 플레이리스트 · 주변 사람/따라가기/반응 · 차트. 이번 테스트에서 볼 것이 탐색 · 주변 탐색 · 검색 · 여정 넷이라 나머지 입구를 닫았다. 코드는 지우지 않았고 `NEXT_PUBLIC_FEATURE_{PROFILE,PLAYLIST,SOCIAL,CHART}=1` 로 되돌린다. 원복 시점은 이 항목과 같다 |
| A-18 | **`GET /api/music/journey` 가 항상 500 이다** | `start`·`end` 곡 ID | — | 2026-09-12 BE 회신: 원인은 `JourneyService` 내부가 아니라 **`JourneyPathFinder` 구현체가 없어서**다. `backend/dev` 에도 작업 브랜치에도 구현이 없어 곡 ID 와 무관하게 `pathFinder.orElseThrow(...)` 로 500 이 난다. **S15P21A405-224 로 추적 중이고 빠른 수정이 아니다.** 그동안 여정 경로 탐색(JOURNEY·PATH-01)은 쓸 수 없다 — 목으로 되돌릴 수도 없다(목 곡 ID 가 실제 ID 와 숫자만 겹쳐 엉뚱한 별에 매칭된다). **2026-09-12 저녁 해소 확인 —** 같은 엔드포인트가 200 으로 응답한다. 실측 2건: `start=3725330&end=6321998` 200 · 1,158ms, `start=3725330&end=4803049` 200 · 4,046ms. 22곡짜리 경로가 제목·아티스트·`location` 까지 채워져 돌아왔다 | **해소됨 (2026-09-12 실측)** |
| A-19 | **설문 응답 저장 API** (S15P21A405-250) | `POST /api/feedback` — `{ kind: "nearby"|"transition", musicId, centerMusicId?, rank?, startMusicId?, endMusicId?, prevMusicId?, position?, totalStops?, answers: string[][], anonymousId, surveyVersion, forced, elapsedMs, answeredAt }` | ok | 유저 테스트에서 **곡과 곡 사이의 유사도·전환이 자연스러운지**를 테스터 응답으로 재는 설문이다. 프론트는 목 라우트(`src/app/bff/feedback/route.ts`)로 받아 콘솔에 찍기만 한다 — **응답이 서버에 안 남으면 설문을 돌려도 집계할 것이 없다.** 로그인을 태우지 않으므로(A-17) 사용자 식별은 `anonymousId`(브라우저 localStorage UUID) 뿐이다. `answers` 는 단계별 선택값의 배열이고 **문항·단계가 바뀔 수 있어서 값 목록을 고정 컬럼으로 잡으면 안 된다** — 문자열 배열(또는 JSON)로 저장하고 `surveyVersion` 으로 버전을 구분한다. `elapsedMs` 가 너무 짧은 응답은 대충 찍은 것으로 걸러내는 용도다 | 협의 중 (백엔드 작업하기로 함, 2026-09-12) |
| A-20 | **`videoId` 를 상세·주변 응답에서 빼 달라** (S15P21A405-340) | `POST /api/music/videoid` — `{ musicIds: [id] }` → `{ items: [{ musicId, videoId }] }` | 그대로 | 프론트가 **곡 상세를 여는 순간 그 곡 하나만** 이 전용 엔드포인트로 조회하도록 갈아탔다. 그 조회는 스웨거 설명대로 **DB 에 없으면 외부 videoId API 를 호출해 채운 뒤 저장**하는 동작이라, 여러 곡을 한꺼번에 치면 그만큼 외부 호출이 붙는다. 그런데 지금 **`GET /api/music/detail` 응답에 videoId 가 11개(그 곡 + 주변 10곡), `GET /api/music/nearby` 응답에 10개** 실려 온다 (2026-09-15 실측). 프론트는 더 이상 그 필드를 읽지 않으므로 **두 응답에서 빼도 화면은 안 깨진다.** 빼면 상세·주변을 열 때마다 따라붙던 대량 채우기가 사라진다 | 협의 전 (프론트 전환 완료, 백엔드 제거 대기) |
| A-20 | **곡 장르가 비어 있다** | `GET /api/music/detail?id=` · `nearby` · `major` | `genres: []` | 배포 데이터 1,082곡이 **전부** 빈 배열이다 (2026-09-14 실측). 프론트는 장르로 별 색과 앨범 커버 대체색을 칠하는데(`genreColor`), 값이 없으면 전부 `무장르`(id 10) 한 색이 된다 — **지도가 단색이 되고 설문 카드의 두 곡이 같은 색 사각형으로 보인다.** 목 데이터에서는 색이 나뉘어서 이 문제가 안 보였다 | 협의 전 |
| A-21 | **앨범 커버 주소** | — | `albumCoverUrl` 을 `detail`·`nearby`·`journey` 응답에 추가 | 프론트에 자리는 이미 있다(`components/common/album-cover.tsx`) — 값만 오면 곡 상세와 설문 카드가 함께 커버를 그린다. 지금 응답에는 `mbid` 와 `album` 이름이 있는데, `mbid` 를 Cover Art Archive 의 `release`·`release-group` 으로 조회하면 404 다(2026-09-14 실측) — **recording MBID 로 보이므로 recording → release 를 한 번 더 타야 커버에 닿는다.** 프론트에서 곡마다 외부 조회를 하면 요청이 곡 수만큼 늘어서 백엔드가 미리 담아주는 쪽이 맞다 | 협의 전 |
| A-22 | **주변 탐색 이웃에 `duration` 이 없다** | `GET /api/music/nearby?id=` | `neighbors[].duration` 추가 | 설문의 `listened_sec` 은 이제 **실제 재생된 시간**이라(임베드의 재생·정지를 따라간다) `videoId` 가 있는 곡은 끝나면 시계도 멈춘다. 문제는 **`videoId` 가 없는 곡**이다 — 임베드가 안 붙어 재생 여부가 낙관값이라 안 멈추고, 카드를 띄워두거나 탭을 놔두면 곡 길이보다 큰 값이 나온다 (2026-09-14 실측: 이웃 10곡 중 1곡 `1623627` 이 `videoId` 없음). 곡 길이를 알면 거기서 자를 수 있는데 **이웃 응답에 `duration` 이 없다**(현재 키: id·title·artist·album·genres·youtubeUrl·videoId·location·distance). 경로 탐색(`stops[].duration`)에는 있어서 거기만 잘린다. 덤으로 `center` 는 키가 id·title·artist·location 4개뿐이라 장르·앨범도 안 온다 | 협의 전 |
| A-23 | **`GET /api/feedback/answered` 가 아직 머지 전이다** (S15P21A405-346) | `anonymousId=<uuid>` (인증 선택) | `[{ mode, anchorMusicId, prevMusicId, musicId, verdict }]` | S15P21A405-346 이 **같은 사람 × 같은 문항 1회 저장**을 넣으면서 이 조회도 함께 만들었는데, `backend/dev` 에도 **아직 안 들어갔다** (2026-09-15 확인, MR 단계). 프론트는 이게 없으면 방금 답한 문항을 또 묻고 서버는 저장하지 않고 조용히 버린다 — 사용자에게는 같은 질문이 두 번 뜨는 고장으로 보인다. 프론트는 `/bff/feedback/answered` 통로를 만들어 두고 **실패를 삼키게** 해 뒀으니(404 면 이번 탭에서 답한 것만 기억) 머지 전에도 안 깨진다. 배포 DB 에 `explore_feedback_003_answered_index.sql` 실행이 함께 필요하다 | 협의 전 (**FE 준비 완료, BE 머지 대기**) |
| A-24 | **설문 `prev_music_id` 가 경로표의 인접 역이 아닐 수 있다** | `POST /api/feedback` | 그대로 | 재생 불가 역(`videoId` 없음)은 **없는 셈 치고 간선을 잇는다** (S15P21A405-335). A→B→C 에서 B 를 못 들려줬으면 `prev=A, music=C, rank=2` 인 행이 정상적으로 생긴다. `findAnsweredId` 의 문항 키가 `prev` 를 포함하므로 저장·중복 방지는 그대로 동작한다. **다만 정본(`01_EXPLORE_SURVEY.md` §5)의 "역 번호별 끊김률" 쿼리는 `rank` 기준**이라, rank 와 prev 가 인접하지 않는 행이 섞인다는 것을 알고 읽어야 한다. 거리 구간별 정밀도 쿼리는 `COALESCE(prev, anchor)` 로 조인하므로 영향 없다 | 협의 전 (알림) |
| A-25 | **재생 불가 곡에서 순차 재생이 멈춘다** | — | — | `videoId` 가 없는 곡은 임베드가 안 붙어 `ended` 이벤트가 안 오고, 그래서 `next()` 가 안 불려 **그 곡에서 큐가 정지한다.** 주변 10곡 순차 재생·여정 재생에서 그 뒤 곡을 아무도 못 듣는다 (2026-09-14 실측: 이웃 10곡 중 1곡이 `videoId` 없음 → 평균적으로 10곡 중 뒤쪽 절반이 날아간다). 설문 표본을 직접 깎지만 **설문 버그가 아니라 재생 버그**라 S15P21A405-335 범위 밖이다. 프론트 별도 이슈 필요 | 프론트 과제 (기록용) |
| A-38 | ~~A-17(조회 API 무인증 개방) 원복이 영구인지 확인 필요~~ **확인 완료 — 영구다. 물어볼 것 없음** | — | — | **백엔드 코드를 읽어 확정했다** (2026-09-20). `backend/src/main/java/com/ssafy/backend/config/SecurityConfig.java` 가 `anyRequest().authenticated()` 이고, `permitAll` 은 로그인·재발급·OAuth 콜백·헬스체크·설문·신고 등 **열거된 경로만**이다. `/api/music/**` 은 그 목록에 없다(`/api/music/report` 만 있다). 주석이 근거를 밝힌다 — *"정본 §0.7: 로그인/토큰 재발급/OAuth 리다이렉트·콜백/헬스체크만 공개, 나머지는 전부 인증 필요(기본 거부, S15P21A405-33)"*. **배포본(`backend/jenkins`)도 같다** — dev 와의 차이는 웹소켓 두 줄뿐이다. 즉 A-17 은 임시 조치였고 **정본 설계로 되돌아간 것**이며, 되돌아올 일은 없다. 프론트는 S15P21A405-481(호출자 토큰 중계) + S15P21A405-480(로그인 필수)로 맞췄고 **2026-09-20 배포 후 지도가 정상 표시되는 것을 확인했다.** `BACKEND_ACCESS_TOKEN` 폴백은 이제 의미가 없다 | ✅ 해소 (2026-09-20, 코드 확인) |
| A-39 | ~~구글 idToken audience 클라이언트 ID 확인 요청~~ **백엔드 건이 아니었다 — GCP 콘솔 설정 누락** | `POST /api/auth/login/google` | — | **질문 자체가 틀렸다** (2026-09-20). `security/GoogleIdTokenVerifierAdapter.java` 가 `spring.security.oauth2.client.registration.google.client-id`(= `GOOGLE_CLIENT_ID` 환경변수)를 그대로 `setAudience` 한다 — 백엔드 코드에 박힌 값이 없으므로 **백엔드가 고칠 것이 없다.** 실제 증상은 따로 있다: 브라우저에서 구글 버튼을 누르면 **`400 origin_mismatch`** 다. 프론트는 GSI(브라우저가 idToken 을 받는 방식, S15P21A405-129)를 쓰는데 그 방식은 GCP 콘솔의 **"승인된 JavaScript 원본"** 이 필요하고, 그 클라이언트는 **백엔드 리다이렉트 흐름용으로만 설정돼 있어 원본 목록이 비어 있다.** 실측: `/oauth2/authorization/google` → 구글이 `redirect_uri=https://j15a405.p.ssafy.io/login/oauth2/code/google` 를 **정상 수락**(리디렉션 URI 는 등록돼 있음). **필요한 조치(저장소 밖):** 콘솔에서 그 클라이언트의 승인된 JavaScript 원본에 `http://localhost:3000` 과 `https://j15a405.p.ssafy.io` 추가. 리디렉션 URI 는 건드리지 않는다. **참고:** 구글은 사설 IP(`http://172.20.10.6:3000` 등)를 JavaScript 원본으로 허용하지 않으므로 **폰에서 로컬 서버를 볼 때 구글 로그인은 쓸 수 없다** — 이메일 로그인을 쓴다 | 백엔드 아님 · **GCP 콘솔 대기** (2026-09-20) |
| A-40 | ~~같은 이메일로 이메일 가입 후 구글 로그인하면 어떻게 되나~~ **확인 완료 — 기존 계정으로 로그인된다** | `POST /api/auth/login/google` | — | **백엔드 코드를 읽어 확정했다** (2026-09-20). `auth/service/AuthService.java` 의 `loginWithGoogleIdToken` 이 `authMapper.findByEmail(identity.email())` 로 찾아, **있으면 `touchLogin` 으로 그 계정에 로그인**시키고 없을 때만 새로 만든다. 즉 이메일·비밀번호로 가입한 계정과 같은 이메일의 구글 계정은 **같은 계정으로 합쳐진다** — 별도 계정도, 오류도 아니다. 프론트가 따로 안내할 분기가 없다. **덤으로 확인:** `withdraw` 는 `authMapper.deleteByEmail` 로 **하드 삭제**다(로그: *"회원 탈퇴로 인한 하드 삭제 완료"*). 익명화가 아니므로 탈퇴 후 같은 이메일로 재가입된다 | ✅ 해소 (2026-09-20, 코드 확인) |
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
| A-43 | `GET /api/playlist/detail` | 변경 없음 | **`likeCnt`(int)·`isLiked`(boolean) 추가** | 프론트 `PlaylistDetail.isLiked` 를 채운다. `isLiked` 는 플레이리스트 소유자가 아니라 **요청한 사람**이 눌렀는지다. 접근 범위는 A-54 에서 **누구나 조회**로 바뀌었다 | ✅ 구현됨 (S15P21A405-447) · **프론트 반영 필요** |
| A-44 | `GET /api/playlist/liked?email=` | `email`(소유자 아닌 **좋아요를 누른 사람**) | `{ content: [{ playlistId, playlistName, musicCnt, likeCnt, ownerEmail, ownerNickname, likedAt }] }` | 피드의 "좋아요한 플리" 탭. 남이 만든 플레이리스트가 섞이므로 소유자 정보를 함께 내려준다. 정렬은 좋아요를 누른 시각 역순. 공개 범위는 `/playlist/search` 와 같다 — 비공개 사용자의 목록은 본인만 볼 수 있다. 페이지네이션 없음(`/playlist/search` 와 동일). 오류: `USER_NOT_FOUND`, `USER_PRIVATE` | ✅ 구현됨 (S15P21A405-447) · **프론트 반영 필요** |
| A-45 | `GET /api/stats/weekly` | 없음 (전체 집계) | `{ weekStart, weekEnd, discovery[], explore[], contribution[] }`. 각 항목: `{ rank, email, nickname, imageUrl, count }`, 각 10명 이하 | 이번 주 랭킹. 구간은 **한국 시간 월요일 00:00 이상 ~ 다음 월요일 00:00 미만**이고 서버 시간대와 무관하다. `discovery` 는 그 주에 처음 재생된 곡 수, `explore` 는 재생 횟수(같은 곡 중복 포함), `contribution` 은 신고 건수(비로그인 신고 제외). 동점자도 서로 다른 순위를 받고 같은 점수면 email 순이다. 탈퇴해 `user` 에 없는 사람은 순위에서 빠진다. ⚠️ **DB 담당**: `db/music_discovery_001_table_and_indexes.sql` 적용 필요 — `music_discovery` 테이블 생성, 과거 재생 기록 백필, 세 테이블의 구간 인덱스가 들어 있다 | ✅ 구현됨 (S15P21A405-448) · **프론트 반영 필요** · **DDL 적용 필요** |
| A-47 | `GET /api/music/major` · `GET /api/music/detail` | 기존과 같음 | 응답에 `albumMbid` 추가 (대표곡은 `content[]` 원소에, 곡 상세는 top-level 에) | 앨범(MusicBrainz release) MBID. 커버를 여는 열쇠는 `mbid`(recording) 가 아니라 이 값이다 — FE 가 Cover Art Archive 를 직접 받는다(S15P21A405-518). 출처는 `music.album_mbid`(S15P21A405-291 적재분) 이고 **값이 없는 곡은 `null`** 이라 절차적 커버 폴백이 계속 필요하다. Jackson 기본 설정이라 JSON 키는 **`albumMbid`** 이다(`album_mbid` 아님) | ✅ 구현됨 (S15P21A405-520) · **프론트 반영 필요** |
| A-46 | `music_discovery` 테이블 | — | — | 곡별 **최초 청취자**를 기록한다. `music_id` 가 PK 라 곡당 한 줄이고 그 줄을 만든 사람이 발견자다. 곡 재생(`MusicPlayService.play`) 때 `INSERT ... ON CONFLICT DO NOTHING` 으로 같은 트랜잭션에서 넣는다. ⚠️ **기록은 realtime 프로파일의 재생 경로에서만 쌓인다** — 그 경로를 타지 않는 재생은 발견왕에 반영되지 않는다 | ✅ 구현됨 (S15P21A405-448) · **적용 필요** |
| A-48 | `POST /api/music/like` | `{ musicId, liked }` — `liked` 는 토글이 아니라 **목표 상태** (A-41 과 같은 규약) | `{ musicId, liked, likedAt }` — 취소면 `likedAt` 은 `null` | 곡 단위 좋아요. 같은 요청을 반복해도 결과가 같다(멱등). 오류: 없는 곡 404 `MUSIC_NOT_FOUND`, 필드 누락 400 `INVALID_INPUT`. DDL(E-8)은 운영에 적용됐다 | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** |
| A-49 | `GET /api/music/liked` | 없음 (인증 주체 기준) | `{ content: [{ ...MusicDetail, likedAt }] }` — 곡 필드는 **`MusicDetail` 을 그대로 평평하게** 싣는다(`id, mbid, title, artist, bpm, duration, album, albumMbid, releaseYear, youtubeUrl, videoId, location, playCnt, youtubeCnt`) + `likedAt`. 최근 좋아요순 | 마이페이지의 **가상 플레이리스트**. 별도 `playlist` 레코드를 만들지 않으므로 `playlistId` 가 없다(spec 009 FR-021 이 자동 생성을 금지한다). 목록의 임의 곡부터 끝까지 기존 재생 큐에 그대로 넣는 것이 전제(SC-009). 페이지네이션 없음. **2026-09-25 모양 변경(S15P21A405-650)**: 전용 필드 묶음을 버리고 `MusicDetail` 로 바꿨다. FE 가 이 목록을 **플레이리스트 컴포넌트**로 그리는데, 플레이리스트 상세의 곡이 `MusicDetail` 이라 같은 모양이어야 좌표로 별자리를, `albumMbid` 로 커버를 그린다. ⚠️ **곡 식별자 키가 `musicId` → `id` 로 바뀌었다.** 이전에 "`albumMbid` 는 목록형 DTO(`MusicSummary`)와 같이 움직일 문제라 일부러 뺐다"고 적었는데, 이 화면은 검색 결과 같은 목록이 아니라 플레이리스트 쪽이라 그 근거는 틀렸다(목록형은 커버를 그리지 않아 뺀 것이다 — S15P21A405-520). 좌표 없는 곡은 `location: null` 이고 목록에서 빠지지 않는다. 조회는 늘지 않았다 — 서비스가 원래 `MusicDetail` 로 받아 오고 있었다 | ✅ 구현됨 (S15P21A405-512 · 650) · **프론트 반영 필요** |
| A-50 | `GET /api/taste-analysis` | 없음 (인증 주체 기준) | `{ state, counts{ totalLiked, valid, excluded, exclusions }, reportEligibility{ eligible, level, additionalLikesNeeded }, analysisVersion, axes[], points[{ musicId, title, artist, coordinates[16] }], report{ level, aiGenerated, fresh, summary, narratives[{ findingId, text, evidence }], analyzedAt, generatedAt, lastRefreshedAt }, generation{ status, generatedThisRequest, dailyLimitUsedToday, canRetry, failureCode, nextAvailableAt } }` | 현재 좋아요 곡의 **기존 PC 좌표** 통계와 마지막 성공 리포트를 함께 준다. PCA 재학습·좌표 재산출은 이 기능 범위가 아니다. 유효 곡 10개 미만은 분포만, 10~29 `INITIAL`, 30 이상 `STANDARD`. `report.fresh=false` 면 좋아요나 분석 버전이 바뀌어 리포트가 STALE 이라는 뜻이다. **마지막 시도가 GMS 실패였으면** 그때 저장한 대체 리포트를 `report.aiGenerated=false`, `generation.status=FALLBACK`, `generation.failureCode`, `canRetry=true` 로 준다 — 생성 응답과 같다. 대체 문장이 없는 실패(lease 만료 등)는 이전 성공 리포트(없으면 `report=null`)에 `failureCode` 만 싣는다 (S15P21A405-647, A-81). 오류: 기준 산출물 없으면 503 `TASTE_REFERENCE_UNAVAILABLE` | ✅ 구현됨 (S15P21A405-512, 647) · **프론트 반영 필요** · **기준 산출물 필요** |
| A-51 | `POST /api/taste-analysis` | 없음 (인증 주체 기준) | A-50 과 같은 스키마 | 성공·재사용·fallback 모두 **200** 이다(201 아님) — 같은 요청이 결과에 따라 201/200 을 오가지 않게 통일했고, 신규 생성 여부는 `generation.status` 로 구분한다(2026-09-22 확정). 사용자가 **버튼을 눌렀을 때만** 리포트를 생성한다. 성공한 생성만 KST 기준 1일 1회 한도를 차감한다. 같은 snapshot 이면 저장 결과를 재사용한다(`generation.status=REUSED`, GMS 미호출). GMS 실패는 `FALLBACK` 으로 내려가고 **한도를 차감하지 않으며 같은 날 재시도할 수 있다**. 오류: 생성 진행 중 409 `TASTE_ANALYSIS_IN_PROGRESS`(`error.details.nextAvailableAt` = lease 만료 시각), 유효 곡 10개 미만 422 `TASTE_INSUFFICIENT_SAMPLE`, 당일 한도 소진 429 `TASTE_DAILY_LIMIT`(`error.details.nextAvailableAt` = 다음 KST 자정), 기준 산출물 없음 503 `TASTE_REFERENCE_UNAVAILABLE` | ✅ 구현됨 (S15P21A405-512) · **프론트 반영 필요** · **기준 산출물 필요** (GMS key 는 운영에 `GMS_API_KEY` 로 주입돼 있다) |
| A-52 | `GET /api/user/detail` | 변경 없음 | **`discoveredMusicCnt`(int) 추가** — 그 사용자가 서비스에서 **처음** 재생한 곡 수 | 피드 대시보드의 "발견한 곡 수"(FEATURES.md 변경 제안 #16, **미확정**). 출처는 주간 발견왕과 같은 `music_discovery`(A-46) 라 이미 남이 들은 곡은 세지 않는다 — "들은 곡 수"는 `playedMusicCnt`(A-36) 다. 비공개 판정 뒤에 센다. 기록은 A-46 과 같이 realtime 재생 경로에서만 쌓인다. ⚠️ **DB 담당**: `db/music_discovery_002_email_index.sql` 의 `(email, discovered_at)` 인덱스를 운영 DB 에 적용해야 한다 — 없으면 상세 조회마다 테이블 전체를 읽는다 | ✅ 구현됨 (S15P21A405-597) · **프론트 반영 필요** · **인덱스 적용 필요** · **명세 확정 필요** |
| A-53 | `GET /api/music/detail` | 변경 없음 (`id`). **인증은 선택** — 토큰을 보내면 좋아요 상태가 채워지고, 안 보내도 401 없이 지금과 똑같이 응답한다 | **`liked`(boolean) 추가** — 요청한 사용자가 이 곡을 좋아요 했는지. 비로그인이면 `false` | 곡 상세 화면의 좋아요 버튼이 하트를 채울지 비울지 판단할 근거. 플레이리스트가 같은 문제를 푸는 방식(A-41 계열, S15P21A405-447)과 맞췄다. `MusicDetail` 레코드가 아니라 **상세 응답 껍데기에만** 넣었다 — 그 레코드는 `JourneyStop` 도 `@JsonUnwrapped` 로 쓰기 때문에, 거기 넣으면 여정 경로가 정거장 수만큼 조회하거나 의미 없는 `false` 를 실어 나른다. `/api/music/major` 는 원소가 `MapPoint` 라 해당 없다. 조회는 `music_like` PK `(email, music_id)` 정타 1회라 상세 응답 시간에 영향이 없다(같은 요청이 이미 이웃 탐색과 videoId 외부 호출을 지난다) | ✅ 구현됨 (S15P21A405-599) · **프론트 반영 필요** |
| A-54 | `GET`·`POST /api/taste-analysis` | 변경 없음 | **`report.findings[]` 추가** — `{ id, type, pc, direction, effectSize, evidence, axisPhrase }`. `narratives` 와 `findingId` 로 1:1 대응한다. 그리고 **INITIAL 요약 접두사 제거** — `"현재 좋아요에서 보이는 잠정 경향으로, "` 를 더 이상 붙이지 않는다 | FE 요청(2026-09-23). 화면이 방향·세기 태그를 그리려면 문장이 아니라 판정값이 필요한데, 지금은 `findingId` 문자열을 파싱하고 median 을 다시 계산해 방향을 추측하고 있었다. 값은 이미 `taste_analysis.findings` 에 저장돼 있어 SQL 변경이 없다. 생성 직후·재사용·fallback·조회 네 경로 모두 같은 값을 준다. ⚠️ **접두사 제거는 spec 009 FR-013·SC-008 과 충돌한다** — 두 항목은 10~29곡 결과에 "잠정 경향 안내"를 요구한다. 화면이 `report.level` 배지로 대신하는 것으로 볼지 **기획 확인 필요**하고, 그렇게 정하면 SC-008 문구도 고쳐야 한다. GMS 지시문의 잠정 어투 요구는 그대로 두었다 그리고 **`axes[].label.axis` 추가** — 축 이름 한 단어(밝기·저음·밀도·결·질감·음량·윗소리·속도·박자·서브베이스·주도·조성·들썩임·북적임·화성·중고역). 화면이 `#밝기 폭넓음` 같은 태그를 만들 때 쓴다. **요약 후보 축은 PC1~9·15·16 의 11개로 좁혔다** — PC10~14 는 라벨이 전문 용어라 문장이 되지 않는다. 16축 분포는 `axes[]` 에 그대로 나가므로 차트는 영향 없다 | ✅ 구현됨 (S15P21A405-634) · **프론트 반영 필요** · **명세 확정 필요** |
| A-54 | `GET /api/playlist/detail` | 변경 없음 | 변경 없음 | **접근 범위 확대** — 소유자만 보던(`FORBIDDEN`) 상세를 로그인한 **누구나** 볼 수 있다. 소유자의 공개 여부(`isPublic`)와도 무관하다(비공개 사용자의 플레이리스트도 `playlistId` 를 알면 열린다 — `/playlist/search` 의 `USER_PRIVATE` 와 다름). A-43 의 "접근 범위 협의 필요"를 닫는다. 오류는 `PLAYLIST_NOT_FOUND` 만 남는다. 수정 API(update·delete·music/*)의 소유자 검사는 그대로다 | ✅ 구현됨 (S15P21A405-603) · **프론트 반영 필요** |

> **취향 분석 기준 산출물을 둘로 쪼개자는 제안 (2026-09-22, BE2) — 협의 필요, 미구현**
>
> 현재 `taste-reference-v1.json` 은 **축별 101분위**와 **축 라벨**을 한 파일에 담고, 둘 중 하나라도 없으면
> 취향 분석 API 2개가 `TASTE_REFERENCE_UNAVAILABLE`(503) 로 멈춘다. 그런데 이 둘은 성질이 전혀 다르다.
>
> | | 101분위 · explainedVariance · lineage | 축 라벨 (`low`/`high`) |
> | --- | --- | --- |
> | 만드는 방법 | `music.location` 집계 — **SQL 한 번** | 태그 log-odds + **사람 3명 검수** |
> | 선행 조건 | 없음 | 데이터 스펙 13(장르 계층) → 14(축 라벨) |
> | 현재 상태 | 언제든 생성 가능 | 스펙 13·14 **둘 다 ⬜ 미착수**, 14 는 **컷 후보** |
>
> 2026-09-22 에 BE 가 운영 `music.location` 28,065곡 표본으로 101분위를 직접 만들어 봤다 — 쿼리 하나에
> 수초다. 반면 라벨은 스펙 13 선행이 걸려 있고, 장르 테이블이 이미 드롭돼(S15P21A405-475, 변경 제안 27)
> 13 을 살릴 동기 자체가 불확실하다.
>
> **제안**: 분위수 산출물과 라벨 산출물을 분리하고, 라벨을 **선택**으로 만든다. 그러면 두 단계로 동작한다.
>
> - **분위수만 있을 때** — 분포 차트·축별 통계·백분위가 전부 동작한다. 축 이름은 `PC3` 같은 중립 표기로
>   내리고 **근거 문장·태그는 비활성**한다(`report` 없이 `state=DISTRIBUTION_ONLY` 유지).
> - **분위수 + 라벨** — 지금 설계대로 문장·태그까지 동작한다.
>
> 이러면 스펙 14 가 컷돼도 취향 분석의 **분포 부분은 살아남는다.** 지금 구조에서는 라벨이 영구히 안 오면
> 기능 전체가 503 으로 멈춘다. ⚠️ 라벨이 PC1~PC4 네 축만 오는 경우도 이 분리로 자연히 처리된다 —
> 나머지 12축은 `unlabeled` 로 두면 통계는 나가고 문장에서만 빠진다.
>
> **Data 파트 확인 필요**: 분위수 산출물을 라벨과 떼어 먼저 줄 수 있는지. **기획 확인 필요**: 축 이름 없는
> 분포 차트만으로 이 기능을 1차 배포할 수 있는지.

> **A-5 곡 수 개정 (2026-09-13, BE2)** — 여정 응답의 `musicCnt` 범위가 **12~22 에서 2~20 으로** 바뀐다.
> 무작위 쌍 기준 **중앙값이 12곡에서 6곡**이 되고, **중간 곡 없이 출발·도착 2곡만 나가는 응답이 정상**이다(오류 아님).
>
> 왜 짧아지나 — 좌표 공간에서 임의의 두 곡 사이에 "서로 구별되는" 곡이 평균 **6.8개**밖에 들어가지 않는다(임의 지점의 최근접 곡까지 거리 p50 2.272, 두 곡 사이 거리 중앙값 15.52). 이전에는 거리와 무관하게 중간역을 10개 이상 꽂아서, 가까운 두 곡 사이 경로가 **직선의 8.6배**를 돌며 엉뚱한 곡으로 채워졌다. 고친 뒤 우회 배수는 1.0~1.5 다.
>
> **프론트 확인 필요**: 곡 수를 하드코딩한 레이아웃이 있으면 어긋난다. 2곡·3곡 목록의 표시 방식도 정해야 한다.
> 별자리 배치 API(A-9, 최대 30곡)에는 영향 없다 — 여정은 항상 20곡 이하다.

---

## 3. 백엔드 계산·전송 전제

### 설문 저장 계약 후속 확인 (2026-09-16, S15P21A405-369)

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| A-33 | `GET /api/music/detail` 응답에 **발매년도가 없다** | `id` | 기존 필드 + `releaseYear` (또는 발매일) | 곡 상세 제목 아래 칩 줄에 발매년도를 넣기로 했다 (SONG-02, S15P21A405-384). ERD 에는 있는 값인데 상세 응답에 안 실려 프론트는 `toMusic` 에서 `releaseYear: null` 로 못 박고 있다(`lib/backend.ts`). 칩은 이미 붙여 뒀고 값이 오면 그대로 뜬다 — **지금은 영영 안 뜬다.** BPM·곡 길이·누적 재생은 잘 온다 | 협의 전 — BE 요청 필요 |
| A-34 | ~~비 ASCII(한글) 닉네임을 거부한다~~ **재현되지 않음 — 취소** | `PATCH /api/user/profile` · `GET /api/users/nickname-available` | — | 2026-09-18 15:1x 에 한글 닉네임이 `PATCH /api/user/profile` 에서 `400 INVALID_INPUT`, 중복확인에서 500 으로 보여 검증 정규식이 ASCII 전용이라고 적었다. **같은 날 16:0x 재확인 결과 전부 정상이다**: `별하나` 저장 200, `테스트닉`·`별하나둘` 중복확인 200. 그 사이에 user 테이블을 타는 엔드포인트가 전부 500 이 되는 장애가 있었으므로(그때는 `/api/music/major` 까지 500), **처음 관찰은 그 장애 구간에 걸린 것으로 본다.** 백엔드 쪽에 할 일 없음 — 기록만 남긴다. 다시 보이면 이 항목을 되살린다 | 취소 (2026-09-18 재확인) |
| A-35 | **마이페이지·프로필에 필요한 값이 배포 API 에 없다** | `GET /api/user/detail?email=` | 지금: email·name·nickname·isPublic·tutorialCompleted·lastActiveAt·createdAt·imageUrl·followerCnt·followingCnt·isFollowing·isMe | 프론트 `UserProfile`(USER-02/04) 이 쓰는 값 중 **다음이 아예 없다**: 지금 듣는 곡(`nowPlaying`), 나와 만난 횟수(`meetingCount`), 따라가는 대상(`followingTarget`), 대시보드 통계(탐험한 곡 수·발견한 곡 수·선호 분위기), 온라인 여부. **팔로우·반응 API 자체도 배포 스펙 34개 경로에 없다** (`/api/user/{email}/follow` 계열). 2026-09-18 실연동 때 목으로 채우지 않고 **빈 값으로 뒀다** — 목을 섞으면 실데이터인 줄 알고 보게 된다. 그래서 지금 마이페이지 대시보드는 0 으로 보인다. 온라인 여부는 **해소됐다 (2026-09-22)** — `GET /api/user/detail` 과 `GET /api/user/follow/list` 에 `isOnline` 이 생겼다(배포 스웨거에서 확인). 소켓 생존 기준(45초 수명·15초 갱신)이고, `lastActiveAt` 은 **로그인 시각**이라 다른 값이다. 5분 창 추정은 걷어냈다 (S15P21A405-545). `updatedAt` 도 응답에 없어서 프론트 타입을 nullable 로 바꿨다 | 요청됨 (2026-09-18, S15P21A405-462) |
| A-36 | **화면은 있는데 배포 API 에 아예 없는 기능들** | — | — | 2026-09-18 배포 스펙 34개 경로를 전수 대조한 결과, 프론트 화면·훅·BFF 라우트가 다 있는데 **백엔드에 대응 경로가 없는 것**이 아래다. **(1) 플리 좋아요** — 토글도 `좋아요한 플리 목록`도 없다. 마이페이지의 그 섹션은 지금 빈 목록이고, 좋아요 버튼은 501 `NOT_IMPLEMENTED` 로 실패한다(목으로 켜 두면 새로고침 때 꺼져서 '가끔 저장이 안 되는' 고장으로 보인다). **(2) 플리 무드 태그·소유자·생성/수정 시각** — `PlaylistDetailResponse`·`PlaylistSearchResponse` 에 없다. 소유자가 없으니 `isMine` 이 늘 false 라 남의 플리와 내 플리를 구분하지 못한다. **(3) 차트(인기 플리·유저 랭킹) (4) 주변 사용자 (5) 따라가기 (6) 반응 (7) 재생 기록(play_history)** — 경로 자체가 없다. 이 여섯은 **목을 남겨 뒀고** 라우트 첫 줄에 목이라고 못 박아 뒀다(`⚠ 목이다`). 화면이 이미 다 있어서 API 가 생기면 그 파일만 바꾸면 된다. **지표·시연에 이 값을 쓰면 안 된다.** 우선순위를 정해 주면 프론트는 그 순서로 붙인다 | 요청됨 (2026-09-18, S15P21A405-468) |
| A-37 | **프로필 사진 삭제 API** | — | — | `PATCH /api/user/image` 는 `file` 이 필수라 **사진을 지우는 길이 없다.** 지금은 다른 사진으로 덮는 것만 된다. 예전 `PATCH /api/user/profile` 은 `imageUrl: null` 로 지울 수 있었고 화면도 "비우면 지워집니다" 로 안내했는데, 경로가 갈리면서 그 길이 없어져 프론트에서 그 안내를 걷어냈다. `DELETE /api/user/image` 든 `file` 없는 PATCH 든 지우는 방법이 하나 필요하다 | 요청됨 (2026-09-18, S15P21A405-474) |
| A-26 | 사람×문항 중복 저장의 원자성 확인 | `origin/backend/dev`의 346 구현은 `findAnsweredId` 후 `upsert`이고 UNIQUE는 `(session_id, rank)`다. 여러 탭의 동시 제출에는 중복 행이 가능하다. 프론트는 단일 탭 중복 제출을 막고 동일 본문으로 재시도하지만 DB 수준 보장은 할 수 없다. 사람 식별/집계 또는 원자적 저장 방안 확인 필요 | 협의 전 — BE 요청 필요 |
| A-27 | 동일 세션·rank의 비교 상대 변경 방지와 실패 행 의미 | FE는 같은 rank에서 문항 키가 달라질 때 새 sessionId를 사용한다. 다른 탐색을 실제 청취했다가 복귀할 때도 새 세션이다. 저장 실패를 verdict=null로 바꾸지 않고, 응답 미시도 질문의 pagehide만 null로 보낸다. 저장 성공 후 응답 유실은 DB 실패 행과 구분할 수 없고, FE는 동일 식별자로 재시도한다 | FE 반영 — 분석 시 세션 분절/실패 표본 미저장에 유의 |

A-23의 과거 “BE 머지 전” 기록은 현재 상태가 아니다. 2026-09-16 `origin/backend/dev`에서 `FeedbackService`, `FeedbackMapper.xml`, answered 조회 및 중복 처리 구현을 확인했다. 이것만으로 배포 DB 적용 여부까지 보증하지 않는다.

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| B-1 | **상주 집합 전송**: 레이어 0은 뷰포트 스트리밍, 화면 안 곡이 게이트(약 5만곡) 이하로 좁혀지면 그 집합을 PC 16개 포함해 통째로 내려준다 (약 2.8MB) | 클라이언트가 재투영·모프를 하려면 PC 값을 들고 있어야 한다 | 협의 전 |
| B-2 | **레이어별 대표곡 선별 기준** (재생수? 밀도? 클러스터 중심?) | 레이어마다 다른 곡이 커버로 떠야 한다 | 협의 전 |
| B-3 | **축 라벨**: 레이어별 두 축의 일상어 라벨을 데이터 확정 후 내려줄 것 (MAP-06) | 지금은 프론트 임시값(`LAYER_AXES`) | 협의 전 |
| B-4 | **레이어 수 8개 / 대표곡 1000개** 전제 확인 | 프론트 상수(`LAYER_COUNT`, `REPRESENTATIVES_PER_LAYER`)가 이 값에 묶여 있다 | 협의 전 |
| B-5 | **재생 로그 호출 빈도 증가**: 지도에서 별을 클릭하면 그 곡이 곧바로 재생되므로 (MAP-08 합치기, S15P21A405-225) 클릭 한 번마다 `POST /music/{id}/play` 가 나간다. 탐색 중 연속 클릭이면 짧은 간격의 로그가 연달아 쌓인다 | 쓰기 부하와 통계(탐험왕·재생수) 해석에 영향. 서버 쪽에서 디바운스·최소 재생시간 필터가 필요한지 확인 필요 | 협의 전 |
| B-6 | **[DATA→BE] videoid 조회 서비스가 저장소로 들어왔다** — `data/videoid/api.py` 가 `GET /videoid?artist=&title=` 계약을 그대로 구현한다(스펙 19, S15P21A405-441). `ody.videoid.base-url` 을 이 서비스로 돌리면 개인 EC2 의 `videoid_api.py` 를 대체한다. 응답에 `best.confidence` 가 `verified` / `best_guess` 로 들어간다 | 지금 EC2 판정은 퍼지매칭 결과를 그대로 저장해 임베드 불가·다른 곡이 `music.video_id` 에 들어간다. 새 판정은 `playable_in_embed`·`availability`·`is_live`·`age_limit` 을 실제로 조회해 확인한다 | 협의 전 |
| B-7 | **[DATA→BE] `duration` 을 videoid 조회에 실어 보내달라** — `GET /videoid?...&duration=<초>`. `VideoIdApiClient.lookup(artist, title)` 에 길이 인자를 하나 추가하는 변경이다 | 길이 대조 없이는 공식 음원으로 **확정할 수 없다**(`confidence` 가 `verified` 로 올라가지 못하고 전부 `best_guess` 가 된다). 같은 곡이 duration 있으면 0.98, 없으면 0.83 으로 떨어지는 것을 실측했다. S15P21A405-407 이 이미 `findDetailsByIds` 로 duration 을 끌어오므로 그 값을 그대로 넘기면 된다 | 협의 전 |
| B-8 | **[DATA→BE] `best.confidence` 저장 정책 결정 필요** — 추측(`best_guess`)값을 `music.video_id` 에 영구 저장할지, 아니면 응답에만 쓰고 저장은 `verified` 만 할지 | 유사도 추측은 `data/specs/15_playability/spec.md:38` "추측 금지" 와 충돌한다. data 파트는 판정 근거를 다 내려보내고 저장 여부는 호출자가 결정하도록 남겨 뒀다. 기획 확인이 필요하다 | 협의 전 |
| B-9 | **[DATA→BE] 캐시 미스 시 3초 읽기 타임아웃을 못 지킬 수 있다** — 첫 조회는 검색 2회 + 영상 확인 최대 3회다. 두 번째 호출부터는 sqlite 캐시에서 즉시 나온다 | `VideoIdApiClient:30` 이 읽기를 3초에서 끊는다. 타임아웃이면 백엔드는 `Optional.empty()` 로 받고 저장하지 않으므로 다음 호출에 다시 시도한다 — 동작은 안전하지만 첫 조회가 자주 빈다. 선적재 배치가 필요한지 판단 필요 | 협의 전 |

---

## 4. 실시간(소켓) 필요 항목

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| S-1 | 따라가기 동기화 — 인솔자의 동작을 **세 종류 이벤트로 따로** 보내야 한다 (SOCIAL-07): ① `leader:view` = 곡 클릭(`viewingMusicId`) ② `leader:play` = 재생 시작(`playingMusicId`) ③ `leader:layer` = 레이어 전환(`layer`) | 뷰는 ①에서 먼저 움직이고, 우주선은 ②가 와야 출발한다. 두 개를 한 이벤트로 합쳐 보내면 이 연출이 불가능하다 | 협의 전 |
| S-2 | 따라가기 자동 종료: 인솔자 접속 종료·비공개 전환 시 (SOCIAL-10-1) | 서버가 알려줘야 한다 | 협의 전 |
| S-3 | 접속 상태·현재 탐색 좌표 실시간 관리 (USER-03) | 주변 사람 목록의 실시간성 | 협의 전 |
| S-4 | 반응 전송·수신 (SOCIAL-02, SOCIAL-04 쿨다운) | 같은 영역 사용자에게 즉시 전달 | 백엔드 반영 · 프론트 반영 필요 (S15P21A405-590, §7) |
| S-5 | 따라가는 인원 수 (SOCIAL-11), 만난 횟수 카운팅 (SOCIAL-05) | 서버 집계 필요 | 협의 전 |
| S-6 | `/app/presence/join {requestSeq, layer, musicId}`: 최초 입장은 요청 곡, 이후 레이어 이동은 서버 현재 곡 유지. 성공 `PRESENCE_JOINED`, 실패 개인 오류 큐. 프론트는 ACK 뒤 viewport·새 곡 play 진행 | REST와 STOMP 사이 처리 순서를 ACK로 보장하고 이전 소켓 요청을 epoch로 차단 | 백엔드 반영 · 프론트 반영 필요 (S15P21A405-423) |

---

## 5. 레이어 사용자 전체 조회 — 프론트 전달 (S15P21A405-533, 2026-09-22)

지도가 **줌 레벨과 무관하게 다른 사용자를 전부 개별 아바타로** 그리기로 했다(팀 결정). 소켓 `VIEWPORT_SNAPSHOT` 은 화면 범위 안만 주고 셀이 36개를 넘으면 인원수(CLUSTERED)로 바뀌므로 이 용도에 맞지 않아, 레이어 전체를 한 번에 돌려주는 REST 를 따로 추가했다. 기존 코드는 수정하지 않았다. A-3 의 실제 구현이다.

### 5-1. 엔드포인트

| 항목 | 값 |
| --- | --- |
| 경로 | `GET /api/realtime/layers/{layer}/users` |
| 인증 | Bearer 필수 (`SecurityConfig` 기본 거부 대상). 토큰 주체(email)는 목록에서 빠진다 |
| `layer` | **0-based** (프론트 `LAYER_COUNT` 와 같다). 0~7 밖이면 `400 INVALID_INPUT` |
| 프로파일 | `realtime` 프로파일에서만 뜬다. 꺼진 배포에서는 404 |
| 실시간 | **push 없음.** 레이어 전환 시 + 주기 폴링(10초 제안)으로 다시 부른다. 소켓 델타는 후속 |

### 5-2. 응답

```json
{ "success": true, "data": {
  "layer": 1,
  "groups": [
    { "musicId": 10877, "x": 5.02, "y": -1.37,
      "users": [
        { "email": "a@x.com", "nickname": "off_beat", "imageUrl": "https://...", "riderCount": 2 },
        { "email": "b@x.com", "nickname": null,       "imageUrl": null,          "riderCount": 0 }
      ] }
  ] } }
```

- `groups[]` 모양은 소켓 `VIEWPORT_SNAPSHOT`(INDIVIDUAL) 의 `groups` 와 **같다** (`ViewportMusicGroup`·`ViewportUser` 재사용). 변환기 하나로 둘 다 처리한다.
- `x`·`y` 는 그 레이어 표시축의 **원시 PC 값** — 레이어 l 이면 `pc[2l]`·`pc[2l+1]`. `MapPoint.pc` 와 같은 좌표계라 지도에 바로 찍는다. 같은 곡을 듣는 사람은 같은 자리다.
- `musicId` 만으로도 위치를 알 수 있다(FE 가 곡 인덱스로 찍는 현재 방식 유지 가능). `x`·`y` 는 그 곡이 지도 상주 집합 밖일 때를 위한 것.
- 좌표를 모르는 곡(`music.location` 없음)의 사용자는 **빠진다**. 서버 로그 WARN.
- `nickname`·`imageUrl` 은 null 가능. 대체 표시는 FE 몫.
- `riderCount` = 지금 그 사람을 따라가는 인원 수.

### 5-3. `NearbyUser` 매핑 (`frontend/src/types/profile.ts`)

| `NearbyUser` 필드 | 출처 |
| --- | --- |
| `email` `nickname` `imageUrl` `musicId` `riderCount` | 응답 그대로 |
| `isOnline` | 목록에 있으면 `true` (재생 중인 사람만 온다) |
| `isPublic` | **응답에 없음.** 비공개 계정 필터를 서버에서 안 한다. 필요하면 백엔드에 요청 |
| `viewingMusicId` `genreId` `meetCount` | **응답에 없음.** FE 기본값 처리 (A-4 는 별건으로 남는다) |

### 5-4. 전제·주의

- Redis 가 채워지는 전제: 사용자가 `POST /api/music/play`(재생 선언) 또는 `/app/presence/join` 을 거쳐야 레이어에 배치된다. FE 가 재생 선언을 안 보내면 목록이 빈다 — 기존 `POST /api/realtime/nearby` 와 같은 전제.
- 목 라우트 `GET /bff/users/nearby?layer=` 를 이 API 로 갈아탈 때 **`layer` 그대로 넘기면 된다**(둘 다 0-based).
- 격자 16×16 셀 전부를 파이프라인 1회로 읽는다. 현재 규모에서 충분. 사용자 수 제한(`individual-user-cap`)은 이 API 에 **적용하지 않는다** — 전부 준다.
- `email` 이 응답에 있다. 계약서 §0 "payload 에 email 금지" 와 어긋나지만, `users` PK 가 email 이고 FE 가 email 을 아바타 키로 쓰며 backend/dev 의 `ViewportUser` 도 이미 email 을 실어 보내므로 그 관례를 따랐다.

---

## 6. 별자리 작품 AI 평가·회차 리더보드 — 프론트 전달 (S15P21A405-563, 2026-09-22)

설계 문서는 `specs/009-constellation-artwork-ai/`(spec·plan·tasks). 여기는 프론트가 붙일 때 필요한 것만 적는다.

**기능 요약**: 사용자가 만든 플레이리스트의 별자리 모양을 회차 주제(1회차 고양이)에 얼마나 닮았는지 AI가 채점하고, 채점된 작품을 점수 순 리더보드로 겨룬다.

⚠️ **이 기능은 FEATURES.md 에 항목이 없다.** `SOCIAL-12`(랭킹, 미확정)는 주간 **좋아요** 기준이라 다른 줄이다. 기획 확인 대상.

### 6-1. 엔드포인트

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/artwork/round/current` | 선택 | 지금 열린 회차. 없으면 `data: null` (오류 아님) |
| `POST` | `/api/artwork/submit` | 필요 | 플레이리스트를 작품으로 제출 → `201` |
| `GET` | `/api/artwork/leaderboard` | 선택 | 회차 리더보드 (`SCORED` 만) |
| `GET` | `/api/artwork/detail` | 선택 | 작품 상세 |
| `GET` | `/api/artwork/mine` | 필요 | 내 작품 (모든 상태) |
| `POST` | `/api/artwork/like` | 필요 | 좋아요 목표 상태 변경 |
| `POST` | `/api/artwork/retry/{artworkId}` | 필요 | 실패 작품 재평가 |
| `DELETE` | `/api/artwork/{artworkId}` | 필요 | 작품 삭제 |

인증 "선택" 은 비로그인도 볼 수 있다는 뜻이고, 로그인 상태면 `likedByMe` 가 채워진다.

### 6-2. 제출은 즉시 끝나지 않는다 — **프론트가 다시 조회해야 한다**

```jsonc
// POST /api/artwork/submit  요청
{ "playlistId": 12 }
// 201
{ "success": true, "data": { "artworkId": 501, "status": "PENDING" }, "error": null }
```

평가는 서버 스케줄러가 뒤에서 한다(기본 5초 주기). 제출 응답은 **언제나 `PENDING`** 이다. 점수를 보려면 `/api/artwork/detail` 이나 `/api/artwork/mine` 을 다시 부른다. **소켓 알림은 없다** — 폴링하거나 화면 재진입 때 갱신한다.

`status` 는 `PENDING` · `SCORED` · `FAILED` 셋이다. `FAILED` 는 `score` 가 **`null`** 이다(0 이 아니다) — 0점으로 표시하면 "못생겼다"는 뜻이 된다.

### 6-3. 같은 회차 재제출은 기존 작품을 **지우고** 새로 만든다

점수·좋아요가 승계되지 않는다. 누르기 전에 "지금 점수와 좋아요가 사라진다"를 고지해야 한다. 서버는 확인 없이 바로 교체한다.

### 6-4. 응답 모양

```jsonc
// GET /api/artwork/leaderboard?roundId=&page=0&size=20   (roundId 생략 = 열린 회차, size 최대 50)
{ "round": { "roundId": 1, "theme": "고양이", "startsAt": "...", "endsAt": "..." },
  "items": [ { "artworkId": 501, "rank": 1, "title": "밤산책", "ownerEmail": "a@b.c", "ownerNickname": "루나",
               "status": "SCORED", "score": 87, "aiComment": "귀 두 개가 또렷하다",
               "failReason": null, "likeCnt": 12, "likedByMe": false,
               "musicCnt": 14, "createdAt": "..." } ],
  "page": 0, "size": 20, "totalCnt": 137 }

// GET /api/artwork/detail?artworkId=501
{ "artworkId": 501, "roundId": 1, "theme": "고양이", "title": "밤산책",
  "ownerEmail": "a@b.c", "ownerNickname": "루나", "mine": false, "status": "SCORED", "score": 87,
  "aiComment": "...", "failReason": null, "likeCnt": 12, "likedByMe": false,
  "points": [ { "musicId": 900, "x": -0.42, "y": 0.13 } ],
  "musics": [ /* MusicDetail. points 와 같은 순서 */ ],
  "createdAt": "...", "evaluatedAt": "..." }

// POST /api/artwork/like   { "artworkId": 501, "liked": true }
{ "artworkId": 501, "liked": true, "likeCnt": 13 }
```

- `points` 의 `musicId`·`x`·`y` 는 `POST /api/constellations/layout`(A-9) 응답과 **필드명·의미가 같다** — 별자리 뷰를 그대로 재사용할 수 있다.
- `rank` 는 서버가 매긴다. 정렬은 **순위 점수(`rankScore` = 좋아요 + AI 점수 / 100 × K) 내림차순** → `score` 내림차순 → 먼저 제출한 순이라 동점도 순서가 확정된다 (2026-09-23 S15P21A405-616 에서 변경 — §6-9).
- `musics` 는 곡이 지워졌으면 그 자리만 빠진다. `points` 는 그대로다 — 그림이 깨지지 않는 것이 우선이다.
- `failReason` 은 **소유자에게만** 채워진다.

### 6-5. 신규 에러 코드 — `frontend/src/types/api.ts` 에 추가 필요

| code | HTTP | 언제 |
| --- | --- | --- |
| `ARTWORK_NOT_FOUND` | 404 | 없는 작품, 또는 **남의 미채점 작품** |
| `ARTWORK_ROUND_CLOSED` | 409 | 열린 회차가 없는데 제출 |
| `ARTWORK_NOT_FAILED` | 409 | 실패가 아닌 작품에 재평가 요청 |
| `ARTWORK_RETRY_EXHAUSTED` | 409 | 재시도 3회 소진 |

제출 시 기존 코드도 그대로 온다: 남의 플레이리스트 403 `FORBIDDEN`, 곡 수 2~30 위반 400 `INVALID_INPUT`, 없는 플레이리스트 404 `PLAYLIST_NOT_FOUND`, 좌표 없는 곡 404 `MUSIC_NOT_FOUND`.

### 6-6. 전제·주의

- **곡 수는 2~30.** 배치 API(A-9)와 같은 제약이다. 31곡 이상 플레이리스트는 제출이 400 이다 — 프론트가 미리 막거나 안내해야 한다.
- 아직 점수가 없는 **남의** 작품은 상세가 `404` 다(403 이 아니다 — 존재 여부를 흘리지 않는다). 좋아요도 누를 수 없다.
- 채점 이미지는 **서버가 저장된 좌표로 렌더한다.** 프론트가 캔버스 이미지를 보내는 API 는 없고 앞으로도 두지 않는다(점수 조작 방지).
- ⚠️ **DB 담당**: `backend/src/main/resources/db/artwork_001_tables.sql` 적용 필요 — 테이블 4개·시퀀스 2개·인덱스 4개와 1회차 행이 들어 있다. 적용 전에는 작품 API 전부가 실패한다.
- ⚠️ **인프라**: 배포 호스트 env 에 `GMS_BASE_URL`·`GMS_API_KEY`·`GMS_MODEL` 필요. 비어 있어도 서버는 뜨고 작품만 `FAILED` 로 남는다.

---

## 8. 인솔자 지도 화면 종류 공유(RIDE_VIEW) — 프론트 전달 (S15P21A405-591, 2026-09-22)

따라가기가 옮겨 주던 것(곡·재생·화면 위 사람·곡 상세 패널)에 **인솔자가 지도를 어떤 모양으로 보고 있는지**를 더했다. `RIDE_PANEL` 과 같은 방식 — 내용은 안 보내고 "무엇을 보는지" 만 보낸다. 받는 쪽이 그 번호로 기존 조회 API 를 부른다. 기존 코드는 수정하지 않았다(enum 값 추가·탑승 직후 발송 한 줄·해체·마지막 하차 시 키 삭제 추가만).

### 8-1. 인솔자 → 서버 (C→S)

`/app/ride/view` 로 보낸다. 라이더가 보내면 개인 오류 큐로 `RIDE_NOT_CAPTAIN`.

| `kind` | 필수 번호 | 프론트 상태 대응 |
| --- | --- | --- |
| `default` | 없음 | `viewMode = "default"` |
| `journey` | `startMusicId`, `endMusicId` | `viewMode = "constellation"` + 여정 결과 |
| `playlist` | `playlistId` | `viewMode = "constellation"` + 플레이리스트 |
| `nearby` | `centerMusicId` | `viewMode = "nearby"` (`nearbyCenterMusicId`) |

```json
{ "kind": "journey", "startMusicId": 10877, "endMusicId": 4927 }
```

번호가 빠지거나 `kind` 를 모르면 개인 오류 큐로 `RIDE_VIEW_INVALID`.

### 8-2. 서버 → 라이더 (S→C)

라이더 개인 큐 `/user/queue/presence`, 봉투 `type` = `RIDE_VIEW`. payload 는 요청과 같은 모양이고 종류에 맞지 않는 번호는 `null` 이다.

```json
{ "type": "RIDE_VIEW", "seq": 31,
  "payload": { "kind": "journey", "startMusicId": 10877, "endMusicId": 4927, "playlistId": null, "centerMusicId": null } }
```

- **중간에 탄 사람도 받는다.** 탑승 응답(`POST /api/realtime/ride`) 직후 `RIDE_VIEWPORT` 와 같은 타이밍에 `RIDE_VIEW` 가 한 번 온다. 인솔자가 기본 지도면 **안 온다** — 라이더도 기본이라 보낼 것이 없다.
- 라이더는 이 값으로 자기가 조회한다: `journey` → `GET /api/music/journey?start=&end=`, `playlist` → 플레이리스트 조회, `nearby` → `GET /api/music/nearby?id=`. 한 명이 조회에 실패해도 그 사람만 빈 화면이다.
- 선단이 흩어지거나(`RIDE_ENDED`) 마지막 라이더가 내리면 서버가 저장값을 지운다. 라이더는 `RIDE_ENDED` 를 받으면 자기 화면을 기본으로 돌린다(이미 그렇게 하고 있을 것).

### 8-3. 프론트 반영 필요

1. **인솔자 발송 4지점** — `viewMode`/여정/플레이리스트/주변 탐색 상태가 바뀌는 자리에서 `/app/ride/view` 발송. 따라오는 사람이 0명이어도 보낸다(저장만 되고 나중에 타는 사람이 받는다). 따라가는 중(`riding`)이면 보내지 않는다 — 569 의 `shouldDeclare` 와 같은 함정.
2. **라이더 수신** — `RIDE_VIEW` 핸들러: `kind` 에 따라 기존 진입 함수(여정 열기·플레이리스트 별자리·`enterNearby`·`exitNearby`) 호출. 라이더 쪽 오버레이 조작 UI 는 막혀 있어야 한다(B-5).
3. `RIDE_VIEW_INVALID` 오류 코드 타입 추가.

### 8-4. 하지 않은 것

- 오른쪽 패널(주변사람·랭킹) 공유. 별도 요청이 있을 때.
- 여정·플레이리스트 내용 전송. 조회 API 가 이미 있어 받는 쪽이 부른다.

### 6-7. 별자리 좌표계 변경 + 고양이 플레이리스트 생성 (S15P21A405-595, 2026-09-23)

⚠️ **`POST /api/constellations/layout`(A-9) 의 모양이 바뀐다.** 응답 형식은 그대로(`{points:[{musicId,x,y}]}`, -1~1), 값이 바뀐다.

| | 이전 (S15P21A405-265) | 이후 (595) |
| --- | --- | --- |
| 축 | 그 곡 집합만의 PCA 상위 2축 | **pc1 → x, pc2 → y 고정** (지도 1레이어와 같은 축) |
| 정규화 | 중심 이동 + 동일 배율, 최대 절댓값 1 | 같음 |
| 같은 집합 → 같은 좌표 | ✓ | ✓ |
| 레이어 무관 고정 배치 (PATH-01) | ✓ | ✓ |
| 지도 1레이어 위치와 일치 | ✗ | **✓** — 별자리 = 1레이어에서 그 곡들의 상대 위치 |
| 임의 집합이 화면을 채우는 정도 | 넓음 | 좁을 수 있음 (pc1/pc2 분산만큼) |

**왜**: 사용자가 모양을 의도해 만들 수 있어야 "플리 모양이 상품" 이 성립한다. 지도 1레이어에서 고양이 자리의 곡을 골라도 집합 PCA 가 다른 축을 잡으면 고양이가 풀렸다. 만드는 좌표계·보는 좌표계·채점하는 좌표계를 하나로 맞췄다. 작품 스냅샷의 `layout_version` 은 `v2.1-pca16/pc12` 로 기록돼 이전 스냅샷(`v2.1-pca16`, 집합 PCA)과 구분된다. **FE 코드 변경 없음.** 기획 확인 대상(PATH-01 문구 "16차원 좌표를 2D로 압축" → "pc1/pc2 고정축").

**신규 엔드포인트 2개**

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/artwork/templates` | 필요 | 고양이 템플릿 목록 `[{name, label, pointCount}]` |
| `POST` | `/api/artwork/generate` | 필요 | 템플릿 모양대로 곡을 골라 **내 플레이리스트 생성** → `201`. 제출은 안 한다 |

```jsonc
// POST /api/artwork/generate
{ "template": "sitting" }          // templates 의 name. 없는 이름 → 400 INVALID_INPUT
// 201
{ "playlistId": 12, "playlistName": "고양이 앉은 고양이 143012", "template": "sitting",
  "musicCnt": 23, "fitError": 0.08,
  "points": [ { "musicId": 900, "x": -0.42, "y": 0.13 } ] }   // layout API 와 같은 값·같은 순서
```

- 템플릿: `sitting`(앉은 옆모습 23곡) · `sketch`(18곡) · `loaf`(엎드린 17곡). 채점 진단에서 `sitting` 이 few-shot 기준 위에서 90점을 받은 그림 그대로다.
- 곡 선택: 전체 곡(재생 불가 제외) 중 pc1/pc2 평면 최근접. 점마다 다른 곡. 템플릿 크기를 4단계로 놓아 보고 평균 오차가 가장 작은 배치를 택한다.
- `fitError`: 템플릿 점과 실제 곡 위치의 평균 거리 ÷ 템플릿 반폭. 0 이 완벽. 화면에 "정확도" 로 보여줘도 되고 무시해도 된다.
- 흐름: `templates` → `generate` → (사용자가 별자리 확인) → `POST /api/artwork/submit {playlistId}`. 자동 제출 없음 — 재제출 시 기존 점수가 사라지는 정책과 부딪히지 않게 사용자가 결정한다.
- 플리 이름은 `고양이 <라벨> <HHmmss>` 라 같은 사람이 여러 번 만들어도 이름 중복(409)이 안 난다.

### 6-8. 그린 별자리 매칭 — 자유 그리기 (S15P21A405-598, 2026-09-23)

사용자가 캔버스에 찍은 점마다 서로 다른 곡을 골라 준다. **플레이리스트를 만들지 않는다** — 사용자가 결과를 보고 기존 `/api/playlist/create` 로 저장한다. 명세 `specs/010-drawn-constellation-playlist/`, 계약 원문 `contracts/draw-match.md`.

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `POST` | `/api/artwork/draw` | 필요 | 점 3~20개 → 곡·좌표·모양 일치도 → `200` |

```jsonc
// POST /api/artwork/draw
{ "points": [ { "x": 0.12, "y": 0.80 }, { "x": 0.45, "y": 0.20 }, { "x": 0.78, "y": 0.81 } ] }
//   x·y: 캔버스 기준 0~1 (클릭 위치 ÷ 캔버스 크기). x 오른쪽, y 아래. 순서 = 연결 순서 = 재생 순서
// 200
{ "score": 98, "quality": "HIGH",
  "points": [ { "musicId": 900, "title": "곡 제목", "artist": "가수", "x": -0.42, "y": 0.13 } ] }   // 요청 순서 그대로, 곡 중복 없음. artist 없으면 null
```

- `score`: **모양 일치도** 0~100. 그림과 결과를 이동·회전·확대로 맞춘 뒤 비교한다. 좌우 반전은 다른 모양. AI 채점(§6)과 무관.
- `quality`: `HIGH`(≥90) · `MEDIUM`(≥70) · `LOW`. **`LOW` 도 200** — 성공 표시 대신 "낮은 품질" 경고를 띄우고 미리 듣기·저장은 허용한다.
- `points` 좌표 = 같은 `musicId` 목록으로 `POST /api/constellations/layout` 한 값. 저장 후 다시 열어도 같은 별자리다.
- 같은 그림이면 항상 같은 결과다. "다른 결과 보기" 없음 — 그림을 고치면 결과가 바뀐다.
- 닫힌 모양(마지막→첫 점 잇기)·중간 점 빼기는 허용(기획 결정). 닫기는 요청에 싣지 않는다 — 매칭과 무관한 표시 옵션이다.
- 후보 곡은 **재생 가능한 곡 전체**다(레이어 0 상주 집합이 아니다). 결과는 그린 방향 그대로 나온다(회전 탐색 없음).
- 결과는 그림과 **같은 방향**으로 나온다(회전 탐색 없음). 겹쳐 보여주려면 그린 점을 y 반전(`1 − y`) → 무게중심 이동 → 최대 절댓값으로 나눠 -1~1 로 만들면 같은 좌표계다.
- 저장: `POST /api/playlist/create { "playlistName": "...", "musicIdList": [draw 응답 musicId 순서 그대로] }`. 이름 기본값은 FE 가 채운다(같은 이름이면 409 `PLAYLIST_NAME_DUPLICATED`).

**에러**

| 상황 | HTTP | `error.code` | 안내 |
| --- | --- | --- | --- |
| 점 3개 미만·20개 초과·좌표 누락/0~1 밖 | 400 | `INVALID_INPUT` | 입력 개수 부족 (화면이 먼저 막는다) |
| 점이 한 곳에 몰림 (bbox 긴 변 < 캔버스의 2%) | 400 | `ARTWORK_DRAWING_DEGENERATE` **(신규 — `types/api.ts` 추가 필요)** | 입력 모양 오류 |
| 서버 오류 | 500 | `INTERNAL_SERVER_ERROR` | 매칭 처리 실패 |
| 10초 무응답 (FE 요청 타임아웃) | — | — | 매칭 처리 실패 |

화면(점 찍기·자동 연결·`n / 20`·최소 3개 전 생성 비활성·20개 제한·마지막 점 취소·전체 초기화·결과 뒤 그림 수정 시 결과 무효·비교 화면·순서대로 미리 듣기·저장)은 spec US1~4 가 기준이다.

### 6-9. 작품 순위(AI + 좋아요)·좋아요 3표·닫힌 모양·곡 목록 (S15P21A405-616, 2026-09-23)

기획(효정) 결정: §6 모델(비동기 채점·회차당 1작품·재출품 초기화)을 유지하면서 좋아요를 순위에 넣는다. FE 콘테스트 목(A-62~A-70)은 이 절의 API 로 교체한다 — **즉시 심사(A-64)는 채택하지 않는다**. 계약 원문 `specs/011-artwork-ranking-votes/contracts/artwork-api-delta.md`.

**순위** — `rankScore = likeCnt + score × K / 100`, K 는 회차별(기본 5, "AI 만점 = 좋아요 5개"). 정렬 `rankScore ↓ → score ↓ → 먼저 낸 순`. 좋아요 하나는 언제나 정확히 +1, 남의 좋아요는 내 점수에 영향이 없다. K·표 한도는 `artwork_round` 행의 `ai_weight`·`vote_limit` — DB `UPDATE` 로 바뀌고 배포·재시작이 필요 없다.

**좋아요 3표** — 회차당 **남의** 작품에 최대 3개. 거두면 표가 돌아온다(작품이 재출품·삭제돼도). 닫힌 회차 작품은 누르기·거두기 모두 막힌다.

| 바뀌는 응답 | 추가 필드 |
| --- | --- |
| `GET /api/artwork/round/current` (+ 리더보드의 `round`) | `voteLimit`(3), `myVotesLeft`(로그인만, 비로그인 `null`) |
| `GET /api/artwork/leaderboard` 항목 | `rankScore`, `closed`, `points: [{musicId, title, artist, x, y}]` (썸네일·곡 목록 — 카드마다 상세를 부르지 않아도 된다) |
| `GET /api/artwork/detail` | `closed`, `tracks: [{musicId, title, artist, x, y}]` (좌표와 곡 이름이 한 원소. 지워진 곡도 원소는 남고 이름만 `null`. 기존 `points`·`musics` 는 그대로) |
| `GET /api/artwork/mine` 항목 | `closed` (`rankScore` 는 `null`, `points` 는 빈 목록) |
| `POST /api/artwork/submit` 요청 | `closed`(선택, 기본 `false`) — 닫힌 모양이면 채점 그림에도 마지막→첫 곡 선이 그려진다 |

**새 거절 사유** (`POST /api/artwork/like`) — `frontend/src/types/api.ts` 추가 필요

| code | HTTP | 언제 | FE 목 이름 |
| --- | --- | --- | --- |
| `ARTWORK_VOTE_LIMIT` | 409 | 이번 회차 표를 다 씀 (누를 때만) | `CONTEST_VOTE_LIMIT` |
| `ARTWORK_VOTE_SELF` | 400 | 내 작품 (**기존에는 허용됐다**) | `CONTEST_VOTE_SELF` |
| `ARTWORK_ROUND_CLOSED` | 409 | 작품 회차가 닫힘 (기존 코드, 좋아요에도 쓰임) | `CONTEST_NOT_OPEN` |

**FE 콘테스트 목 → 실제 API**

| FE 목 | 실제 |
| --- | --- |
| `GET /bff/contests/current` | `GET /api/artwork/round/current` |
| `POST /bff/contests/{id}/match` | `POST /api/artwork/draw` (§6-8) — 미리보기 점수는 `score`(모양 일치도) |
| `POST /bff/contests/{id}/judge` | **없음** — AI 채점은 출품 뒤 비동기(§6-2). 출품 후 `detail` 을 다시 조회해 `SCORED` 를 기다린다 |
| `POST /bff/contests/{id}/entries` | `POST /api/playlist/create` → `POST /api/artwork/submit {playlistId, closed}` |
| `GET /bff/contests/{id}/entries?sort=final` | `GET /api/artwork/leaderboard` |
| `POST`·`DELETE .../vote` | `POST /api/artwork/like {artworkId, liked}` |
| `POST .../save` | `POST /api/playlist/create` (출품작 `points` 의 `musicId` 순서) — 저장 수는 없다 |

**없는 것 (이번 범위 밖)**: 즉시 심사, AI 게이트, 최종점수 식(AI×0.5+투표×0.5), 저장 수, 발표 시각·최종 순위 고정, 재출품 횟수 제한(재출품은 §6-3 대로 점수·좋아요 초기화).

- ⚠️ **DB**: `backend/src/main/resources/db/artwork_003_ranking_votes.sql` — 2026-09-23 운영 적용 완료.
| S-4 | 반응 전송·수신 (SOCIAL-02, SOCIAL-04 쿨다운) | 같은 영역 사용자에게 즉시 전달 | **연동됨 (2026-09-23, S15P21A405-607).** 전송 `POST /api/realtime/reactions` `{toEmail, reactionKey}` → 프론트 `/bff/realtime/reactions`. 수신 개인 큐 `REACTION` `{fromEmail, reactionKey, sentAt}`. 거부 `REACTION_SELF`(400)·`REACTION_NOT_NEARBY`(409)·`REACTION_COOLDOWN`(429)·`PRESENCE_ERROR`(422). **프론트는 주변 사람 패널 전원에게 펼쳐 보낸다** — 명세는 "내 위로 떠서 주변에 보이는" 방송이라 1:1 이 아니다. 백엔드에 "같은 층 전원" 방송 API(toEmail 없는 형태)를 요청할지 협의 필요. 이모지 키는 `rocket fire heart poop pray` 5개(프론트 소유, 서버는 형식만 검사) |
| S-5 | 따라가는 인원 수 (SOCIAL-11), 만난 횟수 카운팅 (SOCIAL-05) | 서버 집계 필요 | 협의 전 |


## 곡 신고 테이블 제안 (S15P21A405-377)

프론트가 먼저 붙였고 백엔드는 아직 없다. 아래는 **제안**이라 그대로 갈 필요는 없다 — 다만 `reason` 값 셋은 프론트가 이미 보내고 있으니 바꿀 때 알려 달라.

```sql
CREATE TABLE music_report (
  report_id    BIGSERIAL    PRIMARY KEY,
  music_id     BIGINT       NOT NULL REFERENCES music(music_id),
  -- 1차 배포는 로그인을 안 태운다 (A-17). 로그인 사용자는 이메일이 남고, 아니면 NULL 이다
  user_email   VARCHAR(255) NULL REFERENCES "user"(email),
  -- 비로그인 신고를 사람 단위로 묶으려면 필요하다. **프론트가 아직 안 보낸다** (아래 "정해야 할 것" 참고)
  anonymous_id UUID         NULL,
  reason       VARCHAR(16)  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT music_report_reason_chk CHECK (reason IN ('spoken', 'noise', 'other')),
  -- 로그인이든 아니든 누가 보냈는지는 하나는 있어야 집계가 된다
  CONSTRAINT music_report_who_chk CHECK (user_email IS NOT NULL OR anonymous_id IS NOT NULL)
);

-- 같은 사람이 같은 곡을 여러 번 눌러도 한 건으로 본다. 한 사람이 몰아서 찍은 편향을 막는다
CREATE UNIQUE INDEX music_report_once_per_user
  ON music_report (music_id, COALESCE(user_email, anonymous_id::text));

-- "신고가 많이 쌓인 곡" 을 뽑는 것이 이 표의 쓸모다
CREATE INDEX music_report_by_music ON music_report (music_id, reason);
```

### 정해야 할 것

| 항목 | 프론트 입장 | 정해야 하는 쪽 |
| --- | --- | --- |
| 중복 신고 | 같은 사람 × 같은 곡은 한 건. 두 번째는 200 으로 조용히 넘겨도 되고 409 여도 된다 — 프론트는 어느 쪽이든 같은 알림을 띄운다 | 백엔드 |
| 비로그인 허용 | **허용해야 한다.** 1차 배포가 로그인을 안 태운다 (A-17) | 백엔드 |
| 비로그인 사람 식별 | **프론트가 아직 안 보낸다.** 설문이 쓰는 `localStorage["ody_anon_id"]` 를 재사용하면 되지만, 그 파일(`lib/anonymous-id.ts`)은 **설문을 걷어낼 때 같이 지워지는 것**이라 신고가 기대면 그때 깨진다. 중복 방지를 사람 단위로 하려면 그 파일을 설문 밖으로 빼는 작업이 먼저다 — 필요하면 말해 달라, 프론트가 붙인다 | 양쪽 |
| 신고 누적 후 처리 | 이번 범위 밖. 지도에서 곡을 거르는 기준(몇 건부터? 사유별 가중치?)은 정해진 바 없다 | 기획 |
| `reason` 확장 | 지금 셋으로 시작. 늘리면 프론트 `constants/report.ts` 와 CHECK 제약을 **같이** 고쳐야 한다 | 양쪽 |

### 프론트 현재 상태

- 목 라우트가 받아서 서버 콘솔에 `[report:mock] <musicId> {"reason":"..."}` 만 남긴다. **아무 데도 저장되지 않는다.**
- 본문은 `{ reason }` 하나뿐이다. `musicId` 는 경로에 있고, 사람 식별자는 위 사유로 아직 안 보낸다.
- 실호출 표식(`okLive`)을 달지 않았다 — 목을 실데이터로 오해하지 않기 위해서다.
- 실연동이 붙으면 라우트 핸들러만 바꾸면 되고 화면·훅은 그대로다.


## 설문 이유 `compare` 추가 (S15P21A405-380)

### 무엇을 바꿔야 하나

`explore_feedback.reason` 이 받는 값에 **`compare` 하나**를 더해 주면 된다. 테이블 구조는 그대로다.

```sql
-- 기존 CHECK 이 값을 열거하고 있다면 (프론트 타입이 그렇게 가정한다: types/survey.ts)
ALTER TABLE explore_feedback DROP CONSTRAINT explore_feedback_reason_chk;
ALTER TABLE explore_feedback ADD CONSTRAINT explore_feedback_reason_chk
  CHECK (reason IS NULL OR reason IN ('dup', 'mood', 'tempo', 'spoken', 'compare'));

-- enum 타입으로 되어 있다면
ALTER TYPE explore_feedback_reason ADD VALUE 'compare';
```

**지금 CHECK 목록이 실제로 무엇인지 우리가 모른다.** 프론트 타입 주석이 "백엔드 CHECK 제약과 같은 값이어야 한다" 고만 적고 있고, 배포본에 `reason` 값을 확인해 볼 방법이 없었다(다른 필수 필드 때문에 `400 INVALID_INPUT` 만 돌아온다). 지금 제약이 어떻게 되어 있는지 알려 주면 위 둘 중 맞는 쪽으로 정리하겠다.

### 값 이름을 `compare` 로 한 이유

- 모드를 가리지 않는다. 주변은 기준곡, 여정은 앞 곡인데 **저장 코드는 하나여야** 한 표에서 분석된다 (기존 `mood`/`tempo` 도 문구만 모드별로 다르다).
- 프론트 계약에서 그 곡을 이미 `compare` 라고 부른다 (`SurveyEdge.compare`, `compareLabel`).
- 어느 곡인지는 이미 행에 있다 — 주변은 `anchor_music_id`, 여정은 `prev_music_id`. 이유 값에 곡을 또 담을 필요가 없다.

`anchor` 로 하지 않은 이유: 여정에서 비교 상대는 `anchorMusicId`(출발곡)가 아니라 `prevMusicId`(앞 역)라, 이름이 데이터와 어긋난다.

### 지표에서 어떻게 다뤄야 하나 — 여기가 중요하다

**이 응답을 "연결이 나쁘다" 로 세면 안 된다.** 나머지 넷과 방향이 반대다.

| 이유 | 무엇이 나쁘다는 말인가 | 지표 |
| --- | --- | --- |
| `dup` `mood` `tempo` `spoken` | 알고리즘이 고른 **그 연결**이 나쁘다 | 정밀도 분모·분자에 포함 |
| **`compare`** | 연결이 아니라 **비교 상대 곡 자체**가 이상하다 | **정밀도 계산에서 제외.** 대신 그 곡(`anchor_music_id` / `prev_music_id`)을 따로 집계해 데이터 정제 대상으로 본다 |

`compare` 를 그냥 부정으로 세면, 기준곡 하나가 이상할 때 그 곡의 이웃 10개가 전부 "나쁜 연결" 로 찍혀 지표가 통째로 내려앉는다.

### 곡 신고(A-28)와의 관계

둘 다 "이 곡이 이상하다" 를 받지만 자리가 다르다.

| | A-28 곡 신고 | A-29 `reason = compare` |
| --- | --- | --- |
| 어디서 | 곡 상세 패널, 아무 때나 | 설문 카드, 부정 답 뒤 |
| 무엇을 | 그 곡 자체 (`spoken`/`noise`/`other`) | 비교 상대가 이상해서 이 문항이 무효라는 신호 |
| 표 | `music_report` (신설 요청) | `explore_feedback` (기존) |

합치지 않는 편이 낫다고 본다 — 설문 쪽은 **그 문항을 지표에서 빼는 근거**가 되어야 하고, 신고 쪽은 곡 데이터 정제 대상 목록이다. 다만 `compare` 가 쌓인 곡을 신고와 함께 보면 정제 우선순위를 정하기 쉬울 것이다.

---

## 실시간 연동에서 나온 협의 항목 (S15P21A405-482, 2026-09-20)

실시간 작업명세대로 내 위치·지도 위 사람·주변 사람을 붙이면서 나온 것들이다.
프론트는 명세대로 다 짰고, 아래는 **백엔드·인프라 확인이 있어야 실제로 도는** 항목이다.

| 항목 | 상태 |
| --- | --- |
| 배포 소켓 주소(`NEXT_PUBLIC_WS_ORIGIN`)와 `/ws/websocket` 프록시 | **협의 전** |
| `NEARBY_ENTER` 에 곡 정보(`title`·`artist`)·`distance` 포함 | **협의 전** |
| 직접 호출을 하려면 CORS 에 로컬 오리진 (B-17 과 같은 건) | **협의 전** |
| 조회 API 인증 (A-17 원복 여부) | **협의 전** |
| 따라가기·반응 API | 백엔드 브랜치만 있음, `backend/dev` 미머지 |

### 1. 배포 소켓 주소를 모른다

소켓은 rewrite 를 타지 않고 `NEXT_PUBLIC_WS_ORIGIN` 절대 주소로 직접 연다(명세 §0). 비우면
페이지 오리진에서 `http`→`ws` 로 유추하는데, **배포에서 그 유추가 맞는지 확인되지 않았다.**

- nginx 가 `/ws/websocket` 을 백엔드로 넘기고 `Upgrade`·`Connection` 헤더를 유지하는지
- 유지하지 않으면 유추 주소(`wss://j15a405.p.ssafy.io/ws/websocket`)로는 연결이 안 된다

**없으면 안 되는 것:** 실시간 세 기능 전부. 소켓이 안 붙으면 지도는 곡만 그리는 지금 화면이다.

### 2. `NEARBY_ENTER` 에 곡 정보가 없다

주변 사람 패널은 각 행에 **그 사람이 듣는 곡**을 보여준다. 그런데 `POST /api/realtime/nearby`
스냅샷에는 `title`·`artist`·`distance` 가 있고 **`NEARBY_ENTER` 에는 없다**(명세 §6.2).

그래서 패널을 연 뒤에 들어온 사람은 곡 자리가 빈 채로 뜬다. 프론트가 곡 상세를 따로 부르면
사람이 들어올 때마다 요청이 한 번씩 더 나가고, 같은 곡이면 이미 목록에 있는 값을 베껴 쓰지만
새 곡이면 방법이 없다. `distance` 도 없어서 **정렬 자리를 추측**하고 있다(같은 곡 옆 아니면 맨 뒤).

**요청:** `NEARBY_ENTER`·`NEARBY_MOVE` 에도 `title`·`artist`·`distance` 를 넣어주세요.
**없으면:** 새로 들어온 사람은 "듣는 곡을 불러오는 중" 으로 남고, 목록 정렬이 거리순이 아니게 된다.

### 3. 실시간 REST 3개를 `/bff/` 로 보냈다 — 명세와 다르다

명세 §0 은 "브라우저가 직접 부른다, `/bff/` 라우트를 만들지 않는다" 이고 이유는
**"서버가 대신 부르면 전원이 한 사람으로 취급된다"** 였다.

그 이유가 S15P21A405-481 로 사라졌다 — BFF 가 **호출자의 `Authorization` 을 그대로 넘긴다.**
반대로 직접 호출에는 막는 함정이 있다(S15P21A405-303): rewrite 가 브라우저 `Origin` 을 그대로
넘기는데 백엔드가 `http://localhost:3000` 을 `403 Invalid CORS request` 로 막아서 **로컬에서만
전부 터진다.**

**되돌리기는 쉽다** — 경로를 `/api/...` 로 바꾸고 `live-api-paths.ts` 에 세 줄을 넣으면 된다.
백엔드 CORS 허용 목록에 로컬 오리진이 들어가면(B-17) 그때 옮긴다. **이 선택이 맞는지
백엔드 쪽 확인을 부탁드립니다** — 백엔드가 요청 출처(IP·세션)를 presence 에 쓰고 있다면
BFF 경유가 문제가 될 수 있다.

### 4. 조회 API 인증 — A-17 이 원복된 것으로 보인다

`/bff/map/songs` 가 **401** 을 준다(2026-09-20 실측). A-17(유저 테스트용 임시 인증 해제)이
되돌아간 신호다. 프론트는 S15P21A405-481 로 호출자 토큰을 넘기게 바꿔서 **로그인하면 돌아간다** —
다만 로그인 전 화면이 남아 있다면 그쪽은 여전히 안 된다.

**확인 필요:** A-17 을 의도적으로 되돌린 것인지, 되돌렸다면 로그인 전에 보여야 하는 API 가
남아 있는지.

### 5. 따라가기·반응은 붙이지 않았다 (2026-09-20 재확인)

**처음에 "follow API 가 `backend/dev` 에 미머지" 라고 적었는데 틀렸다.** 브랜치 목록만 보고
판단한 것이었다. 실제로는 아래와 같다.

| | backend/dev | 배포 |
| --- | --- | --- |
| 팔로우(구독) `/api/user/follow/*` | ✅ | ✅ |
| 따라가기(탑승) `POST /api/realtime/ride` | ✅ | ❌ |
| 따라가기 소켓 이벤트 | ❌ | ❌ |

**팔로우와 따라가기는 다른 기능이다.** 팔로우는 오래 남는 구독이고 배포까지 끝나 프론트가
S15P21A405-489 에서 실연동했다. 따라가기는 `RideRestController` 로 따로 있는데 **배포에 없다** —
`@Profile("realtime")` 이고 배포 api-docs 41개 경로에 `/api/realtime/*` 가 하나도 없다.

더 큰 문제는 **소켓 이벤트가 없다는 것**이다. `RealtimeMessageType` enum 주석에 그대로 적혀 있다:
`(반응·따라가기는 이번 범위 밖 — 추가 시 이 enum 확장)`. 탑승은 되는데 선장이 곡을 바꾸거나
레이어를 옮기거나 접속을 끊어도 알릴 길이 없다. 이 문서의 S-1·S-2·S-5 가 그대로 "협의 전" 이다.

프론트는 탑승 버튼을 **로컬 상태로만** 돌리고 목 반응(`useMockFriendReactions`)을 껐다.
없는 API 를 부르는 것보다 안 부르는 쪽이 정직하다.

**요청 ①** `realtime` 프로파일을 배포에 켜주세요 — 지금은 실시간 세 기능과 탑승이 전부 안 됩니다.
**요청 ②** 따라가기 소켓 이벤트(S-1·S-2)를 열어주세요. REST 탑승만으로는 기능이 성립하지 않습니다.

---

## 따라가기(탑승) 연동에서 나온 협의 항목 (S15P21A405-530, 2026-09-22)

프론트가 2차 실시간 작업명세(`프론트_실시간_작업명세_2_따라가기`)대로 탑승·하차를 붙이면서
**배포본(`origin/backend/jenkins`, `backend/dev` 와 realtime 디렉터리가 동일)을 직접 읽고 대조한**
결과다. 배포 스웨거(`/api/v3/api-docs`)에 `POST·DELETE /api/realtime/ride` 가 실제로 있는 것도 확인했다.

> **번호를 A-48 부터 시작한다.** 이 표의 마지막 행은 A-40 이지만 **A-41 ~ A-47 은 이미 코드가
> 쓰고 있다** — 행만 안 적혔을 뿐이다 (A-41·A-43·A-44 는 플레이리스트 좋아요 S15P21A405-492,
> A-47 은 곡 재생가능 여부). 비어 보인다고 다시 쓰면 한 번호가 두 가지를 가리킨다.
> **행이 빠진 그 일곱 개는 누군가 채워야 한다** — 코드에서 `A-4` 로 grep 하면 나온다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-48 | **`snapshotSeq` 와 봉투 `seq` 는 다른 카운터다** | 명세 §4.1 은 "봉투 `seq ≤ snapshotSeq` 면 버린다" 고 적었는데, 코드에서 `snapshotSeq` 는 `HINCRBY ride:playback:{captain} snapshotSeq`(인솔자별 Redis 카운터)이고 봉투 `seq` 는 `webSocketSessionService.nextMessageSeq(userId)`(내 세션 카운터)다 | **그대로 하면 조용히 망가진다.** 한참 틀던 인솔자(`snapshotSeq` 가 큼)에 방금 접속한 사람(`seq` 가 1부터)이 타면 초반 `RIDE_PLAYBACK` 이 전부 버려지고 오류도 안 뜬다. 프론트는 이 비교를 **적용하지 않았다** — 순서 보장은 봉투 `seq` 단조성으로 이미 하고 있다 | **해소 (2026-09-22, 3차 계약 §1)** — 백엔드가 **명세 문구를 고쳤다.** `RIDE_PLAYBACK` 에 `snapshotSeq` 를 싣지 않기로 확정했고, 순서 보장은 봉투 `seq` 단조성이 한다. 프론트는 바꿀 것이 없었다 — 비교를 적용하지 않은 판단이 맞았다. `NearbySnapshot.snapshotSeq` 는 봉투 seq 가 맞으므로 그쪽 규칙(1차 §6.1)은 그대로다 |
| A-49 | `RIDE_RIDER_JOINED` 가 없다 | `RealtimeMessageType` 에 `RIDE_RIDER_LEFT` 만 있다. 명세 §14 도 "아직 없는 것" 으로 적고 있다 | 인솔자가 **누가 탔는지 모른다.** 뷰포트·주변사람 목록은 요청자를 제외하므로 인솔자 자신의 `riderCount` 를 받을 길도 없다 | **해소 (2026-09-22, 3차 계약 §2)** — `RIDE_RIDER_JOINED {email, nickname, riderCount}` 추가. `origin/backend/jenkins` 에서 `RideRiderJoinedPayload` 확인. 탈 때는 처음 보는 사람이라 이름이 같이 온다. 프론트는 인원수 숨김 처리를 걷고 선장 쪽 표시를 붙였다 (S15P21A405-545) |
| A-50 | 인원수 델타 네 종이 배포에 없다 | ~~명세 §2.3·§7.1 의 네 종이 배포 enum 에 없다~~ **들어왔다** (2026-09-22, `58a415eb` "따라오는 인원수를 밀어 주고 거부 사유를 코드로 나눈다"). `VIEWPORT_RIDER_COUNT` · `NEARBY_RIDER_COUNT` · `RIDE_VIEWPORT_RIDER_COUNT` 가 enum 에 생겼고 탑승·하차·이탈 세 곳에서 인솔자를 보는 사람들에게 나간다. `NEARBY_BULK_ENTER` 도 있다 | — | ✅ 해소 (2026-09-22) · 프론트는 이미 받는 코드가 있어 추가 작업 없음 |
| A-51 | `RIDE_STALE` 오류 코드가 없다 | ~~`RealtimeErrorCode` 에 없다~~ **생겼다** (2026-09-22, `58a415eb`). 409 `RIDE_STALE` = "그 사이 상태가 어긋났다, 새로 고치면 풀린다", 접속이 없는 경우는 `PRESENCE_ERROR` 로 떼어 냈다 | — | ✅ 해소 (2026-09-22) · 프론트 `ApiErrorCode` 와 안내 문구 반영 완료 |
| A-52 | 곡 상세 `tab` 값에 대응하는 UI 가 없다 | `RidePanelTab` 은 `nearby`·`info`·`playlists` 를 요구하는데 **우리 곡 상세에는 탭이 없다** (한 장짜리 스크롤) | 기능상 문제는 없다. 프론트는 열 때 `info` 로 고정해 싣고, 받는 쪽은 탭을 보지 않고 그 곡 상세를 연다 (명세 FR-035 의 `nearby` 폴백과 결과가 같다) | 프론트 결정 — 백엔드 조치 불필요 |
| A-53 | 따라가는 동안의 **곡별** 재생시간을 보낼 수 없다 | `RIDE_TRACK` 으로 곡이 바뀌면 서버가 새 `play_history` 를 만들지만 **그 번호가 프론트에 오지 않는다** (명세 §8.7 이 같은 말을 한다) | 탑승 중 곡별 청취시간이 남지 않는다 | **없어진 기능 (2026-09-22)** — `RIDE_TRACK.playHistoryId` 는 계약대로 추가됐고(3차 계약 §3) 프론트도 붙였었다(S15P21A405-545). 그런데 그 뒤 **`PATCH /api/music/play/end` 가 배포에서 빠졌다** — 몇 초 들었는지를 안 남기기로 했다(2026-09-22 배포 스웨거에 없다). 곡별 청취시간이라는 목적 자체가 사라져 프론트 배선을 걷어냈다 (S15P21A405-571). `playHistoryId` 는 서버가 계속 보내므로 타입에만 남겨 뒀다 — 받긴 받되 쓰지 않는다 |

### 백엔드에 드리는 요청 (2026-09-22 재배포 후 남은 것만)

재배포본(`origin/backend/jenkins`)을 다시 읽고 대조했다. **다섯 개 중 둘은 해소됐다** —
인원수 델타 네 종(A-50)과 `RIDE_STALE`(A-51)이 `58a415eb` 로 들어왔다. 아래 셋이 남았다.

> **확인 필요: 실행 중인 빌드가 최신이 아닐 수 있다.** 배포 스웨거에 `58a415eb` 다음 커밋
> (`a68c77d3`)이 추가한 `GET /api/realtime/layers/{layer}/users` 가 **안 보인다.** 그 컨트롤러는
> `@Profile("realtime")` 이고 같은 프로파일의 `/api/realtime/ride` 는 보이므로, 빌드에 있었다면
> 목록에 떠야 한다. 즉 지금 도는 서버는 `a68c77d3` 이전이다. A-50·A-51 은 그보다 앞선
> `58a415eb` 라 포함됐을 가능성이 높지만, 그 커밋은 REST 경로를 안 건드려서 스웨거로는
> 구분되지 않는다. **인프라에 지금 배포된 커밋 해시를 확인해 주시면 좋겠다.**

**① 재생 스냅샷 번호와 소켓 메시지 번호를 견주지 않도록 정리해 주세요 (A-48). 가장 급합니다.**
재배포본에서도 그대로다. `RidePlaybackPayload` 는 여전히 `event`·`state`·`positionMs`·`serverTs`
넷뿐이고 `snapshotSeq` 가 없다. `snapshotSeq` 는 여전히 `HINCRBY ride:playback:{captain}`
(인솔자별 Redis 값)이고, 봉투 `seq` 는 받는 사람 소켓의 메시지 번호다. 세는 대상이 다르다.
그런데 `RideResponse` 주석은 아직 **"snapshotSeq 는 이 응답이 언제 것인지다. 이보다 작은 소켓
이벤트는 버린다"** 라고 적혀 있다. 그대로 따르면 **오래 틀던 인솔자에게 방금 접속한 사람이 탈 때
초반 `RIDE_PLAYBACK` 이 전부 버려진다.** 오류도 로그도 안 남는다.
→ `RIDE_PLAYBACK` payload 에 `snapshotSeq` 를 실어 주시거나, 그 주석과 명세 §4.1 에서 비교를 빼 주세요.
프론트는 위험해서 그 비교를 **적용하지 않았다.** 순서는 봉투 `seq` 단조성으로 이미 지킨다.

**② 누가 탔는지 인솔자에게 알리는 이벤트를 만들어 주세요 (A-49).**
`58a415eb` 가 인원수 알림을 넣었지만 **받는 쪽이 구경하는 사람들이다.**
`ViewportDeltaService.sendRiderCount` 가 `receivers.remove(email)` 로 인솔자 본인을 빼고,
`RideService.notifyRiderCount` 도 그 경로만 쓴다. `RIDE_RIDER_JOINED` 는 아직 `spec.md` 에만 있고
enum 에는 없다. 결국 **인솔자는 지금도 자기를 몇 명이 따라오는지 알 수 없다** — 누가 내릴 때
(`RIDE_RIDER_LEFT`) 처음으로 숫자를 받는다. 프론트는 틀린 숫자를 띄우지 않으려고 인원수를
**아예 안 보여 주고** 있다.

**③ 따라가는 동안 바뀐 곡의 재생 기록 번호를 내려 주세요 (A-53).**
`RideTrackPayload` 도 그대로다 — `musicId`·`layer`·`x`·`y`·`playable`·`serverTs` 뿐이다.
인솔자를 따라 곡이 바뀌면 서버가 새 `play_history` 를 만드는데 그 번호가 프론트에 오지 않아,
**탑승 중에는 곡별로 얼마나 들었는지 남길 수 없다.** 지금은 탈 때 받은 번호 하나로
탑승부터 하차까지를 한 건으로 볼 수밖에 없다.

A-52(곡 상세 탭)는 **백엔드가 하실 일이 없다.** 프론트 처리 방식을 기록만 해 둔 항목이다.

---

## 겹 사용자 전체 조회 연동 (S15P21A405-537, 2026-09-22)

백엔드가 `GET /api/realtime/layers/{layer}/users` 를 열었다 (S15P21A405-533). 그쪽 브랜치의
BACKEND-NOTES §5 에 전달 내용이 있다. 프론트가 붙이면서 정리된 것과 남은 것을 적는다.

### 붙인 방식

- `/bff/realtime/layers/{layer}/users` 라우트가 중계한다. **호출자 토큰으로 부른다** — 응답에서
  요청자 본인이 빠지므로 서비스 토큰으로 부르면 모두가 같은 사람을 뺀 목록을 받아 자기 자신이
  지도에 두 번 그려진다.
- 지도 사람 표시의 **바탕**이 이 조회다. 소켓 `VIEWPORT_*` · `RIDE_VIEWPORT_*` 델타는 그 위에
  얹는다. 합치는 규칙은 `use-viewport-subscription.ts` 의 `mergePeople` 에 있고 시험이 붙어 있다.
- 폴링 10초 (백엔드 제안 그대로). **밀어 주는 이벤트가 없어서** 다른 실시간 조회와 달리 폴링이 맞다.
- **"N명" 뭉치(`CLUSTERED`)를 지도에 그리던 길을 걷어냈다.** 줌과 상관없이 전원 개별로 그리기로 한
  팀 결정과 양립하지 않는다 — 그 모드에서는 개별로 그릴 재료가 아예 오지 않는다.
  엔진의 `setCrowd` 는 지우지 않고 안 부르기만 한다. 되살릴 일이 생기면 그 한 줄이다.

### 백엔드에 남는 것

| # | 항목 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- |
| A-54 | 이 조회의 **소켓 델타** | 10초 폴링이 유일한 갱신이라, 그 사이에 들어온 사람은 화면 밖에 있으면 최대 10초 늦게 보인다. 화면 안이면 기존 `VIEWPORT_*` 델타가 메운다 | 백엔드 후속 예정 |
| A-55 | 응답에 `isPublic` 이 없다 | 비공개 계정을 서버가 거르지 않는다. 프론트는 전원 공개로 가정하고 `true` 로 채운다 — 비공개 정책이 확정되면 그 가정이 깨진다 | 협의 전 |
| A-4 | 응답에 `viewingMusicId` 가 없다 | 그 사람이 **보고 있는 곡**과 **듣고 있는 곡**을 가를 수 없다. 프론트는 둘을 같게 둔다 | 협의 전 (기존 항목) |
| A-56 | 따라가는 중 **겹 알림이 없다** | 인솔자가 층을 옮기면 나도 옮겨지는데 알림이 없어(2차 명세 §8.4) `useMapStore.layer` 가 그대로다. 그 상태로 이 조회를 부르면 **엉뚱한 겹**을 묻는다. 그동안은 `RIDE_VIEWPORT*` 가 메우고, 하차 응답의 `layer` 로 바로잡힌다 | 협의 전 |

**요청** A-56 이 실제로 겪는 문제다. 인솔자가 층을 옮길 때 동승자에게도 겹 번호를 한 번
알려 주시면(`RIDE_TRACK` 에 이미 `layer` 가 있으니 **곡이 그대로일 때도** 보내 주시는 형태면
충분합니다) 이 조회가 맞는 겹을 묻게 됩니다.

---

## 플레이리스트 곡 편집 — 프론트 연동 결과 (S15P21A405-540, 2026-09-22)

곡 목록에서 곡을 빼고 순서를 바꾸는 길을 붙였다. 순서 변경은 `POST /api/playlist/music/reorder`
를 `/bff/playlists/{id}/order` 가 중계한다. **새 순서의 전체 목록**을 `musicIdList` 로 보낸다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-57 | **`GET /api/playlist/detail` 응답에 소유자가 없다** | `PlaylistDetailResponse` 는 `playlistId`·`playlistName`·`musicCnt`·`totalDuration`·`likeCnt`·`isLiked`·`musics` 뿐이다. 소유자 이메일도 닉네임도 없다 | **편집 UI 가 자기 플리에서도 안 떴다.** BFF 가 `email` 을 `null` 로 채우고 화면은 그걸 내 이메일과 견줬으니 늘 남의 플리였다. 지금은 **내 플리 목록(`/api/playlist/search?email=`)에 그 `id` 가 있는지**로 우회한다 — 목록을 한 번 더 받아야 하고, 남의 플리 화면에서는 "누가 만든 것인지" 를 아예 못 보여 준다. 응답에 `email` 과 `nickname` 을 넣어 주시면 우회를 걷어낸다 | 협의 전 |
| A-58 | 순서 변경이 **부분 지시를 받지 않는다** | `musicIdList` 를 통째로 받아 그대로 다시 매긴다. "3번을 1번으로" 같은 요청이 없다 | 문제는 아니다. 다만 두 사람이 같은 플리를 동시에 고치면 **나중 요청이 먼저 것을 통째로 덮는다.** 지금 규모에서는 일어나지 않아 그대로 둔다 | 확인함 · 조치 불필요 |

**요청** A-57 하나입니다. 상세 응답에 소유자(이메일 또는 닉네임)를 넣어 주시면 목록을 한 번 더
받는 우회가 없어지고, 남의 플리에서 만든 사람을 보여 줄 수 있습니다.

---

## 공개/비공개 계정 폐지 — 프론트는 걷어냈다 (S15P21A405-574, 2026-09-22)

기획 확인: **공개/비공개 계정은 없는 기능이다. 전원 공개가 기본이고 설정 자체가 없다.**

### 프론트가 한 것

`isPublic` 을 통째로 끊었다. 타입(`User`·`NearbyUser`·`FollowUserSummary`)·설정 UI·
`PATCH /api/user/public` 을 부르던 뮤테이션과 BFF 라우트를 지웠다. `UserDetailResponse.isPublic` 은
**받고 버린다** — 응답 스키마는 안 건드렸다.

지우면서 나온 것 하나: `map-engine` 이 `!u.isOnline || !u.isPublic` 으로 지도 표식을 거르고 있었다.
그래서 합성 경로 여섯 군데가 전부 `isPublic: true` 를 집어넣고 있었다 — **문을 통과시키려고 넣던 값**이다.
서버가 어느 사용자에게 `false` 를 줬으면 그 사람은 이유 없이 지도에서 사라졌다. 문과 값 둘 다 없앴다.

### 백엔드에 남는 것 — 여기가 본론이다

**프론트만 걷어내면 "버튼은 뜨는데 누르면 403" 이 된다.** `is_public = false` 인 행이 하나라도
있으면 아래 넷이 그대로 막는다 (`origin/backend/dev` 에서 읽음).

| # | 자리 | 지금 동작 |
| --- | --- | --- |
| V-1 | `UserService:49` | 비공개 + 본인 아님 → `403 USER_PRIVATE`. **남의 프로필이 아예 안 열린다** |
| V-2 | `FollowService:105` | 같은 조건으로 팔로워·팔로잉 목록 차단 |
| V-3 | `PlaylistService:65` · `:87` | 같은 조건으로 남의 플리 목록·상세 차단 |
| V-4 | `UserVisibilityController` · `UserService:116` · `UserMapper.updateIsPublic` | 설정 변경 엔드포인트. 부르는 데가 없어졌다 |

`AuthMapper.xml:18` 의 가입 INSERT 는 `is_public` 을 넣지 않는다 — **DB 컬럼 기본값을 탄다.**
그 DDL 이 저장소에 없어 기본값이 `true` 인지 확인하지 못했다. 설정 UI 가 그동안 열려 있었으므로
**이미 `false` 로 바꾼 계정이 있을 수 있다.**

### 요청

1. **V-1~V-3 의 `USER_PRIVATE` 분기를 걷어낸다.** 이것만 해도 증상은 사라진다
2. `is_public = false` 인 행을 **`true` 로 backfill** 하고 컬럼 기본값을 `true` 로 확인한다
3. V-4 와 `is_public` 컬럼·`UserDetailResponse.isPublic` 은 **1·2 가 끝난 뒤** 지운다.
   순서를 바꾸면 프론트가 이미 안 읽으므로 상관없지만, 응답 필드를 먼저 빼도 프론트는 안 깨진다
4. `UserErrorCode.USER_PRIVATE` 도 같이 없어진다. 프론트는 BFF 의 방어 분기를 **그때까지 유지**한다

| # | 항목 | 상태 |
| --- | --- | --- |
| A-59 | 공개/비공개 폐지 — 백엔드 V-1~V-4 + backfill | 협의 전 |

## 주변 사람이 층 기준이 된 뒤 (S15P21A405-582 · 596)

| # | 항목 | 무엇이 걸리나 | 상태 |
| --- | --- | --- | --- |
| A-60 | 패널에 누구를 띄우나 — **물을 것 없음** | 5차 명세가 패널을 "그 층의 미니맵" 으로 적어서 층 전체가 보여야 하는지 물으려 했으나, 2026-09-23 프론트 확인 결과 **미니맵이 아니다.** 규칙은 둘이다. ① 내 곡 주변 `neighborK`(80)번째 곡까지의 거리를 경계로 삼아 그 안의 사람만 띄운다. 가까이 아무도 없으면 **비우고 안내만 띄운다.** ② 경계 안에 몰려 있으면 가까운 순 12명까지. 서버 `realtime.nearby.panel-cap` 12 는 **채우는 값**이라 사람이 적은 층에서 층 반대편 사람까지 넣어 주는데, 프론트가 경계로 다시 거른다 — 서버는 바꿀 것이 없다 | 확인함 · 조치 불필요 |
| A-61 | `NEARBY_BULK_ENTER` 에 **사람별 좌표가 없다** | 5차 명세 §2 는 `ENTER`·`MOVE`·`BULK_ENTER` 가 `x`·`y` 를 담는다고 적었는데, `BULK_ENTER` 는 `musicId` 가 봉투에 하나뿐이라 사람마다 실리지 않는 것으로 읽힌다. 프론트는 그 곡으로 지도에서 자리를 찾아 메운다 — 그 곡이 이 층 상주 집합 밖이면 자리를 못 구해 목록 맨 뒤로 간다. 봉투에 `x`·`y` 를 하나만 넣어 주면 그 틈이 없어진다 | 협의 전 |

## 별자리 콘테스트 — 프론트 목 계약 (S15P21A405-602, 2026-09-23) → **백엔드 `artwork` API 로 실연동 (S15P21A405-640, 같은 날)**

> **A-62~A-70 은 폐기됐다.** 백엔드가 `/api/artwork/*` (S15P21A405-563 · 595 · 598 · 616) 로 구현했고 `origin/backend/dev` 의
> BACKEND-NOTES §6-9 에 "FE 콘테스트 목 → 실제 API" 대응표가 있다. 프론트는 그 표대로 라우트를 갈아 끼우고 목(`src/mocks/contest.ts`)을 지웠다.
> 기획 결정으로 **즉시 심사(A-64)는 채택되지 않았다** — AI 채점은 출품 뒤 서버가 비동기로 하고 화면이 `/api/artwork/mine` 을 폴링한다.
> 타입은 `frontend/src/types/contest.ts` 가 백엔드 DTO 를 옮긴 것이다. 아래 표는 기록으로만 남긴다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-83 | 리더보드·내 작품에 **작품 주인 닉네임**이 없다 | `ArtworkSummary` 는 `ownerEmail` 만 준다 (`origin/backend/dev` `artwork/dto/ArtworkSummary.java`) | 갤러리 카드·순위 줄에 이메일 앞부분(`luna@…` → `luna`)을 적고 있다 (`lib/contest-view` `ownerLabel`). 닉네임을 바꾼 사람이 엉뚱한 이름으로 보인다 — `ownerNickname` 을 같이 내려 주면 바로 바꾼다 | 협의 전 |
| A-91 | 리더보드 `ArtworkSummary` 에 **`playlistId`** 가 없다 (S15P21A405-684) | `artwork.playlist_id` 와 `ArtworkRow.playlistId` 에는 있는데 `ArtworkSummary` 레코드에 빠져 있다 (`origin/backend/dev` `artwork/dto/ArtworkSummary.java`). 프론트는 `playlistId?` 로 받아 없으면 null 로 둔다 (`lib/contest-bff` `toEntry`) | 플레이어바의 "이벤트 N위" 태그가 플리 번호로 탑 5 를 맞추므로 안 뜬다. (지도에 탑 5 를 띄우던 것은 S15P21A405-687 에서 걷어냈다) | 협의 전 |
| A-92 | 작품을 내 플리로 **이미 가져왔는지** 알 길이 없다 (S15P21A405-702) | 가져오기는 전용 API 없이 `POST /api/playlist/create` 에 작품 곡을 싣는다(`bff/contests/save`). 플리와 원본 작품이 이어져 있지 않아, 두 번째 가져오기는 **이름 중복**(409 `PLAYLIST_NAME_DUPLICATED`, `existsByOwnerEmailAndName`)으로만 막힌다 | 프론트는 409 를 "이미 있어요" 로 알리고 버튼을 끄지만 이름으로만 가른다 — 가져온 뒤 이름을 바꾸면 또 가져와지고, 작품과 무관한 같은 이름 플리가 있으면 처음부터 막힌다. 목록을 다시 열면 버튼이 켜진 채다. 요청: ① 가져올 때 원본 작품을 기록(예: `playlist.source_artwork_id`) ② 같은 사람이 같은 작품을 또 가져오면 409 `ARTWORK_ALREADY_SAVED` + 기존 `playlistId` ③ 리더보드·작품 상세에 `savedByMe: boolean` — 또는 ①② 를 묶은 `POST /api/artwork/{artworkId}/save` | 협의 전 |
| A-92 | 곡 상세 `GET /api/music/detail` 이 **처음 여는 곡에서 2~3초** 걸린다 (S15P21A405-691) | `origin/backend/jenkins` `MusicService.getDetail` 이 응답 전에 이웃 계산(`nearbyService.neighborsOf`)과 영상 ID 외부 조회(`videoIdEnricher.resolve`, 주석상 최악 5초)를 차례로 끝낸다. 2026-09-26 브라우저 실측(로그인, 새 곡): 상세 처음 2.2~2.8초 → 두 번째 40~55ms. `POST /api/music/videoid` 처음 2.2~2.8초, 영상 ID 를 받아 둔 뒤 상세 0.9~1.4초, `GET /api/music/nearby` 처음 1.0~1.5초 | 프론트는 영상 ID 를 **따로** `POST /api/music/videoid` 로 받는다(`/bff/music/[id]/video-id`). 그래서 처음 여는 곡은 상세와 그 조회가 같은 곡의 외부 조회를 동시에 두 번 건다. 요청: (1) 상세에서 영상 ID 외부 조회를 빼거나 기다리지 않게 (2) 이웃 계산 첫 호출 1초 안팎의 원인 확인. 프론트는 응답 전에 아는 것(행동 줄·소리 차트)부터 그리게 바꿨다 — 칩·주변곡은 여전히 응답을 기다린다 | 협의 전 |

FEATURES 변경 제안 #36 (CONTEST-01~05, 미확정). 백엔드 설계는 **S15P21A405-548**(AI 평가·리더보드) · **S15P21A405-598**(그린 점 → 곡 매칭) 에서 진행 중이다.
프론트는 아래 모양으로 목(`src/app/bff/contests/*`, `src/mocks/contest.ts`)을 만들어 화면을 먼저 붙였다. **경로·필드는 전부 제안**이며 백엔드 설계에 맞춰 바꿀 수 있다 — 바뀌면 프론트에 알려 주면 라우트만 갈아 끼운다. 타입은 `frontend/src/types/contest.ts`.

| # | API | 요청 | 응답 `data` | 이유 | 상태 |
| --- | --- | --- | --- | --- | --- |
| A-62 | `GET /api/contests/current` | — | `Contest` = `{ id, roundNo, theme, startsAt, endsAt, announceAt, status(OPEN/CLOSED/ANNOUNCED), rules{minPoints, maxPoints, resubmitLimit, voteLimit, aiGate, titleMax}, myEntryId, myVotesLeft, myResubmitsLeft }`. 진행 중인 회차가 없으면 `null` | 진입 버튼(진행 중 점·D-day)과 패널 머리가 이걸로 그려진다. 규칙 값은 **회차마다 바뀔 수 있어** 프론트에 박지 않는다 | 협의 전 |
| A-63 | `POST /api/contests/{id}/match` | `{ points: [{x,y}] }` — 0~1 정규화 캔버스 좌표(y 아래 양수), 3~20개 | `ContestMatch` = `{ tracks: [{musicId, title, artist, x, y}], similarity(0~1), quality(HIGH/MID/LOW) }`. `tracks` 는 **점 입력 순서**, 중복 없음. `x,y` 는 배치 API 규약(-1~1, y 위 양수) | S15P21A405-598 그대로. 프론트는 결과 좌표로 미리보기·썸네일을 그리므로 **결과 좌표가 배치 API(`/constellations/layout`)와 일치**해야 한다(598 AC). 점 수 범위 밖이면 정의된 오류 | 협의 전 |
| A-64 | `POST /api/contests/{id}/judge` | `{ tracks: ContestTrack[], closed }` | `ContestJudge` = `{ score(0~100), comment(≤80자) }` | **즉시 심사** — 매칭 결과가 오는 순간 부른다(기획 확정: 즉시 + 그 점수로 출품). 입력은 **모양만**(곡명·사용자 제외, 공정성). 같은 배치면 같은 답이어야 미리보기 점수 = 출품 점수가 된다 → 배치 해시 캐시 제안. 비용: 점을 바꿀 때마다 부르는 구조라 사용자당 rate limit(분당 20회 제안) 필요. 부담되면 "심사 받기" 버튼 방식으로 바꿀 수 있다 | 협의 전 |
| A-65 | `POST /api/contests/{id}/entries` | `{ title(1~30자), tracks: ContestTrack[], closed }` | `ContestEntry` (아래) · 201 | 출품. 내 출품작이 있으면 **대체**(resubmit_count+1, 표 유지). 점수는 judge 캐시 재사용. `tracks` 는 **스냅샷** — 원본 플리를 고쳐도 출품작은 안 바뀐다(치팅 방지). 오류: `CONTEST_NOT_OPEN`, `CONTEST_RESUBMIT_EXHAUSTED`, 제목·곡 수 검증 | 협의 전 |
| A-66 | `GET /api/contests/{id}/entries?sort=latest\|votes\|ai\|final\|saves` | 정렬 키 (cursor 페이지네이션은 백엔드가 정함) | `ContestEntry[]` = `{ id, contestId, title, ownerEmail, ownerNickname, tracks, closed, aiScore, aiComment, voteCount, saveCount, finalScore, eligible, rank, votedByMe, savedByMe, isMine, createdAt }` | 갤러리·순위가 **같은 목록**을 쓴다 — `sort=final` 이 곧 순위. `eligible = aiScore ≥ rules.aiGate`, `finalScore = ai×0.5 + (votes ÷ 회차 최대 votes × 100)×0.5`(소수 1자리), `rank` 는 eligible 안에서만(동점 AI 우선, 그다음 먼저 낸 순). 썸네일은 `tracks` 의 `x,y` 로 클라이언트가 그린다(이미지 저장 없음) | 협의 전 |
| A-67 | `POST` · `DELETE /api/contests/{id}/entries/{entryId}/vote` | — | `{ voteCount, myVotesLeft }` | 표 주기·거두기. 회차당 `rules.voteLimit`(3), 내 출품작 금지. **플리 좋아요(PATH-07)와 별개 카운터** — 같이 쓰면 콘테스트 플리가 주간 탑 플리 차트를 점령한다. 오류: `CONTEST_VOTE_LIMIT`(409), `CONTEST_VOTE_SELF`(400), `CONTEST_NOT_OPEN` | 협의 전 |
| A-68 | `POST /api/contests/{id}/entries/{entryId}/save` | `{ title? }` | `{ playlistId, saveCount }` · 201 | 출품작 스냅샷을 **내 새 플레이리스트**로 복사(순서 유지). 남의 출품작도 가능, 회차 종료 후도 가능. `save_count+1`. 프론트 목은 지금 `POST /api/playlist/create` 에 `musicIdList` 를 실어 **실제 플리를 만든다** — 백엔드가 이 API 를 만들면 그 안에서 같은 일을 하면 된다 | 협의 전 |
| A-69 | 오류 코드 | — | `CONTEST_NOT_FOUND` `CONTEST_NOT_OPEN` `CONTEST_ENTRY_NOT_FOUND` `CONTEST_VOTE_LIMIT` `CONTEST_VOTE_SELF` `CONTEST_RESUBMIT_EXHAUSTED` | 프론트 `types/api.ts` `BffErrorCode` 에 이 이름으로 넣어 두었다. 사유마다 사용자에게 보여 줄 말이 달라 하나로 뭉치면 안 된다 | 협의 전 |
| A-70 | 데이터 (ERD 에 없음) | — | `contest`(회차·테마·기간·상태·규칙), `contest_entry`(unique(contest_id,user_id), title, track_ids 순서 스냅샷, closed, ai_score, ai_comment, resubmit_count, vote_count, save_count, final_rank), `contest_vote`(unique(contest_id,user_id,entry_id)), `contest_judge_cache`(배치 해시 → 점수·평) | 프론트가 요구하는 필드의 출처. `final_rank` 는 `announceAt` 에 확정 저장, 이후 출품·투표 쓰기는 `CONTEST_NOT_OPEN` | 협의 전 |
| A-71 | `GET /api/stats/weekly` ↔ SOCIAL-12 **종류가 다르다** | — | `{ weekStart, weekEnd, discovery[], explore[], contribution[] }`, 각 칸 `RankedUser { rank, email, nickname, imageUrl, count }` | 2026-09-23 프론트 실연동 (S15P21A405-604). 명세 SOCIAL-12 는 **실시간 탑 버스기사 / 이번주 탐험왕 / 누적 팔로워 / 탑 플레이리스트** 4종인데, 배포된 백엔드(S15P21A405-448)는 **발견왕 / 탐험왕 / 기여도** 3종이다. 겹치는 것은 탐험왕만. 프론트는 백엔드 기준으로 탭을 바꿨다(발견왕·탐험왕·기여도 + 버스기사 "준비 중"), 누적 팔로워·탑 플리 **목 탭은 걷어냈다**. `count` 는 프론트 `score` 로 받는다. 기획이 4종을 유지하려면 백엔드에 팔로워·탑 플리·버스기사 랭킹이 더 필요하고, 3종으로 갈 거면 FEATURES SOCIAL-12 문구를 바꿔야 한다 (변경 제안 #37) | 협의 전 |

**정해야 할 것**
- 즉시 심사 비용 상한 (A-64) — 예상 참가자 수로 한 번 계산해 보고 결정.
- 회차 생성은 어드민 API 로 할지 초기엔 DB insert 로 갈지.
- 지난 회차 아카이브(`GET /api/contests?status=ANNOUNCED`)를 1차 범위에 넣을지. 프론트는 아직 안 붙였다.
- 별밭: 프론트 목의 매칭은 **레이어 0 상주 집합**(`/api/music/major?level=1`) 안에서만 찾는다. 실서비스가 662만 곡 전체에서 찾을지, 대표곡 안에서 찾을지는 598 에서 정한다.

## 따라가기 복원 — 새로고침·재연결 (S15P21A405-615, 2026-09-23)

프론트가 **새로고침·재연결 뒤 같은 인솔자에게 자동으로 다시 탑승**하도록 바꿨다 (`use-ride-session`).
인솔자를 sessionStorage 에 남기고 소켓이 열리면 `POST /api/realtime/ride` 를 다시 보낸다. 백엔드 변경
없이 되는 범위는 여기까지고, 아래는 백엔드가 있어야 되는 것들이다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-72 | **재연결 유예 기간 — 소켓이 끊겨도 탑승·선단을 잠시 유지** | 2차 명세 §8.3: 소켓이 새로 열리면 서버가 이전 위치와 탑승을 지운다. 인솔자가 새로고침하면 선단이 해체되고 따라오던 전원에게 `RIDE_ENDED` 가 간다 | **인솔자 새로고침은 프론트가 못 살린다.** 동승자는 재탑승으로 우회하지만 인솔자는 돌아올 선단이 없다. 재접속 후 30~60초 안에 같은 사용자가 CONNECT 하면 탑승·선단·위치를 그대로 잇고, 넘기면 지금처럼 지우는 방식을 요청 | 협의 전 |
| A-73 | **내 탑승 조회** `GET /api/realtime/ride/me` → `{captainEmail, musicId, layer, playback, positionMs, panel}` (탑승 응답과 같은 모양) 또는 없음 | 없다. 프론트는 저장소의 인솔자로 **다시 탑승**해야만 상태를 얻는다 | A-72 가 되면 재연결 뒤 "지금 내가 타고 있나" 를 물을 길이 필요하다. 새 탭·저장 유실도 이걸로 복원된다 | 협의 전 |
| A-74 | 재탑승이 **새 좌석**으로 계산된다 | 재접속 시 이전 탑승이 지워진 뒤 새로 타므로 `RIDE_FULL` 경합에 걸릴 수 있고, 인솔자에게 `RIDE_RIDER_LEFT` → `RIDE_RIDER_JOINED` 가 연달아 가 인원수가 깜빡인다 | 유예 기간(A-72)이 있으면 둘 다 사라진다. 없다면 재탑승을 좌석 유지로 처리해 달라 | 협의 전 |
| A-75 | 재탑승 시 재생 위치 | 탑승 응답의 `positionMs` 로 이어 튼다 — 이건 지금도 된다 | — | 확인만 (백엔드 할 일 없음) |
| A-82 | **`RIDE_ENDED` 의 `CAPTAIN_LEFT` 가 "잠깐 끊김" 과 "정말 떠남" 을 구분하지 못한다** | 인솔자 소켓이 닫히면 서버가 곧 선단을 해체하고 동승자 전원에게 `CAPTAIN_LEFT` 를 보낸다. 새로고침·네트워크 끊김도 같은 사유로 온다 | 프론트는 이 사유를 받아도 **바로 내리지 않고 45초 동안 같은 인솔자에게 재탑승을 시도**한다 (`lib/realtime/ride-resume`). 정말 떠난 경우 동승자가 45초를 기다린 뒤에야 내려진다. 유예 기간(A-72)이 생기면 잠깐 끊김에는 이 알림 자체가 안 나가야 하고, 정말 떠났을 때만 와야 한다. 그때까지는 `CAPTAIN_DISCONNECTED`(복귀 가능) 같은 임시 사유를 따로 주면 프론트가 기다릴지 바로 내릴지 정확히 정할 수 있다 | 협의 전 |

---

## 취향 분석 — 프론트 연동 결과 (S15P21A405-630, 2026-09-23)

백엔드 취향 분석 API(S15P21A405-512, MR !426)를 마이페이지에 붙였다. 계약은 `origin/backend/dev` 의
`taste/controller/TasteAnalysisController.java` · `taste/dto/TasteAnalysisResponse.java` ·
`common/TasteErrorCode.java` 를 **읽어서** 옮겼다 (`src/types/taste.ts`).

**백엔드가 할 일은 아래 A-77 하나뿐이다.** 나머지는 기록이다.

| # | 항목 | 확인된 사실 | 프론트 조치 | 상태 |
| --- | --- | --- | --- | --- |
| A-76 | `GET·POST /api/taste-analysis` | 경로 하나에 메서드 둘. 조회·생성 응답이 같은 모양(`TasteAnalysisResponse`)이다. 둘 다 `Authentication` 기준이라 **본인 것만** 나온다 | `/bff/taste-analysis` 라우트가 호출자 토큰으로 중계. 생성 응답을 그대로 캐시에 넣어 다시 조회하지 않는다 | 반영됨 |
| A-77 | **남의 취향은 조회할 수 없다** | 두 엔드포인트 다 대상이 토큰 주체다. `email` 파라미터가 없다 | 남의 프로필(USER-04, "마이페이지와 레이아웃 동일")에는 이 칸을 세우지 못한다. **남의 프로필에도 보여 줄 계획이면** `GET /api/taste-analysis?email=` 같은 조회가 필요하다 — 다만 취향은 사생활에 가까워 공개 여부부터 정해야 한다 | 협의 전 |
| A-78 | 오류 코드 4종 | `TASTE_INSUFFICIENT_SAMPLE`(422) `TASTE_DAILY_LIMIT`(429) `TASTE_ANALYSIS_IN_PROGRESS`(409) `TASTE_REFERENCE_UNAVAILABLE`(503) | `ImplementedErrorCode` 에 추가. BFF 가 상태 코드로 뭉치지 않고 그대로 올린다 — 넷 다 사용자가 할 일이 다르다 | 반영됨 |
| A-79 | `state` 6종 · `generation.status` 5종 | `EMPTY` `DISTRIBUTION_ONLY` `READY` `FRESH` `STALE` `IN_PROGRESS` / `NOT_REQUESTED` `INELIGIBLE` `IN_PROGRESS` `GENERATED` `FALLBACK` | `lib/taste-view.ts` 가 화면이 묻는 것(무엇을 띄우나·버튼을 눌러도 되나·뭐라고 적나)으로 바꾼다. 조합 판정은 `tests/taste-view.test.cjs` 가 묶는다 | 반영됨 |
| A-80 | `IN_PROGRESS` 를 끝나는 것을 알 길이 없다 | 응답에 `generation.nextAvailableAt`(lease 만료)만 있고 완료 알림은 없다 | 프론트가 3초 간격으로 다시 묻는다(`use-taste-analysis-query`). **소켓 이벤트가 생기면 폴링을 걷어낸다** — 지금은 생성 중일 때만 돌아서 부담이 크지 않다 | 협의 전 (제안) |
| A-81 | `report.aiGenerated` 가 조회에서는 늘 `true` | `TasteAnalysisQueryService.attachLatestReport` 가 상수 `true` 로 채운다. 생성 응답의 `FALLBACK` 분기만 규칙 기반임을 알 수 있다 | 화면은 `aiGenerated === false` 일 때만 "간단한 요약으로 대신했어요" 를 띄운다 — **새로고침하면 그 사실이 사라진다.** 저장된 리포트가 대체 문장인지 같이 내려 주면 정확해진다 | 협의 전 |

---

## 주변 곡 카드의 앨범 커버 (S15P21A405-671, 2026-09-25)

곡 상세의 "이 곡과 가장 비슷해요!" 카드에 **진짜 앨범 커버가 조건부로만 뜬다.**

배포 백엔드 스키마를 직접 읽어 확인했다 (`GET /api/v3/api-docs`, 2026-09-25).

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-84 | **`NeighborTrack` 에 `albumMbid` 를 실어 달라** | 지금 필드는 `album` `artist` `distance` `id` `location` `title` `videoId` `youtubeUrl` 뿐이다. 같은 문서의 `MusicDetail`·`MusicDetailResponse` 에는 `albumMbid` 가 **이미 있다** — 곡 하나를 열 때는 주고 주변 10곡에는 안 준다 | 주변 곡 카드가 **대부분 절차적 커버로 떨어진다.** 프론트는 지도 엔진의 상주 집합에서 빌려 쓰는데(`song-nearby-card` 의 `getMapEngine().pointOf(musicId).albumMbid`), 주변 10곡은 PC 공간에서 가장 가까운 곡이라 같거나 인접한 격자에 모여 있고 상주 집합은 **격자당 대표 1곡만** 뽑는다. 그래서 겹치는 곡이 많아야 한두 곡이다 (추정 — 실측 못 함) | 협의 전 |

**우회로는 둘 다 접었다.**

- 주변곡마다 곡 상세를 따로 부르기 — 카드 한 줄 띄우려고 요청이 10개 늘고, 그 응답에는 주변 10곡과
  16차원 좌표까지 들어 있다. S15P21A405-514 가 줄이려던 것과 정면으로 충돌한다
- `videoId` 로 유튜브 썸네일 쓰기 — S15P21A405-516·517 에서 이미 기각했다. 앨범 아트가 아니라 영상
  썸네일이라 실데이터 16곡 중 절반이 번호판 사진·인물 스틸이었다

`albumMbid` 는 백엔드가 이미 들고 있는 값이라 **필드 하나 추가**면 된다. 그러면 `song-nearby-card` 의
상주 집합 우회도 같이 걷어낼 수 있다.

## 따라가기 우주선의 얼굴 (S15P21A405-676, 2026-09-25)

인솔자 화면에서 내 우주선 창에 내 사진이 없고, 뒤에 매달린 동승자 헬멧에도 얼굴이 없었다. 프론트 쪽 원인(내 프로필을
엔진이 몰랐다 · 줄에 인솔자 자신을 한 칸 더 세웠다)은 고쳤고, 아래 둘은 백엔드 계약이 걸린다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-85 | `RIDE_RIDER_JOINED` 에 `imageUrl` 이 없다 | 3차 계약 §2 페이로드는 `email` `nickname` `riderCount` 뿐이다 (`types/realtime.ts` `RideRiderJoinedPayload`) | 동승자 헬멧에 사진을 넣으려고 프론트가 사람마다 `GET /api/user/detail?email=` 을 한 번 더 부른다 (`use-ride-session`). 실어 주면 요청 하나가 준다 — 급하지 않다 | 협의 전 (우회 중) |
| A-86 | 동승자는 **같은 선단의 다른 동승자를 모른다** | 뷰포트·주변 사람 목록은 요청자를 빼고(2차 명세 §4.2), 인솔자의 `riderCount` 는 동승자에게 오지 않아 `map-view` 가 0 으로 둔다. 선단 목록을 주는 API 도 없다 | 따라가는 사람 화면에는 우주선 뒤에 **나 혼자**만 매달린다 — 셋이 같이 타도 서로 안 보인다. 탑승 응답(`POST /api/realtime/ride`)에 동승자 목록을 싣거나 `RIDE_RIDER_JOINED/LEFT` 를 동승자에게도 보내 주면 프론트가 그린다 (`queueSlots` 가 이미 목록·수를 받는다) | 협의 전 |

## 상시 접속 계정 (S15P21A405-683, 2026-09-26)

프론트 데모 봇(S15P21A405-536)은 브라우저마다 따로 시뮬레이션해서, 같은 봇을 두 사람이 따라가도 서로 다른 곡이 들렸다.
그래서 걷어냈고, "user" 테이블의 상시 접속 계정을 서버가 돌리는 쪽으로 옮긴다. 화면에서는 일반 사용자와 똑같이 보인다.
origin/backend/dev(8ed83c47) 기준으로 위치·접속은 Redis presence 에만 있고, 전부 클라이언트 소켓·heartbeat·재생 API 호출이 전제라
**서버가 그 역할을 대신해야** 한다. 기능 명세(FEATURES.md)에 없는 기능이라 기획 확인이 필요하다.

| # | 항목 | 확인된 사실 | 없으면 무엇이 안 되나 | 상태 |
| --- | --- | --- | --- | --- |
| A-87 | `UserDetailResponse.isBot` | 없다. 프론트는 `isBot?: boolean` 으로 받아 없으면 false 로 둔다 (`lib/backend.ts` `toUserProfile`). 다른 응답(`ViewportUser`·`NearbyPerson`·`RideRankingItem`)에는 싣지 않는다 | 상시 접속 계정의 팔로워 수 보정(실제 수 + 계정별 800~1500)과 팔로워 목록 막기가 동작하지 않는다. 팔로워 집계(`countFollowers`)는 지금 그대로 둔다 | 협의 전 |
| A-88 | 상시 접속 계정을 서버가 돌리기 | `"user".is_bot` 컬럼, presence 생성·TTL(120s) 갱신 또는 만료 정리 제외, 서버 발급 epoch, 플레이리스트 순서대로 `music.duration` 마다 다음 곡(`MusicPlayService.play` 와 같은 경로 — `PositionChanged`·`RIDE_TRACK`·`savePlayback(PLAYING, 0, now)`), 재시작 뒤 자동 복구, 여러 대면 스케줄러 중복 실행 방지. 재생 기록·발견·만남·재생수는 남아도 된다 | 지도에 상시 접속 계정이 안 보이고, 따라가기 할 상대가 없다. 데모 봇을 걷어냈으므로 **그 사이 지도는 실제 사용자만 보인다** | 협의 전 |
| A-89 | 일반 사용자처럼 보이기 | `email` 이 `RideRankingItem`·`RideRiderJoinedPayload` 에 그대로 나간다. `@ody.bot` 은 데모 봇이 쓰던 도메인이다 | 이메일·닉네임·사진이 티 나면 구분 표시를 안 한 의미가 없다. `nickname`·`image_url` 채움, `is_public`·`tutorial_completed` true, `last_active_at` 갱신 | 협의 전 |
| A-90 | 상시 접속 계정을 따라갈 때 지도 화면 | 이 계정은 viewport 를 열지 않으므로 `RideViewportService.sendCurrentScreen` 이 아무것도 안 보낸다 (meta 없으면 return) | 따라가는 사람 지도가 빌 수 있다 (코드만 읽은 추측 — 화면은 확인 못 함). 계정 자리 중심의 기본 화면을 만들어 줄지 결정 필요 | 협의 전 |

재생 동기화는 백엔드 추가 작업이 없다. 따라가는 쪽이 `RIDE_TRACK.serverTs` 와 재생 스냅샷을 기준으로 스스로 맞춘다 (S15P21A405-682).
