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

---

## 3. 백엔드 계산·전송 전제

### 설문 저장 계약 후속 확인 (2026-09-16, S15P21A405-369)

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| A-33 | `GET /api/music/detail` 응답에 **발매년도가 없다** | `id` | 기존 필드 + `releaseYear` (또는 발매일) | 곡 상세 제목 아래 칩 줄에 발매년도를 넣기로 했다 (SONG-02, S15P21A405-384). ERD 에는 있는 값인데 상세 응답에 안 실려 프론트는 `toMusic` 에서 `releaseYear: null` 로 못 박고 있다(`lib/backend.ts`). 칩은 이미 붙여 뒀고 값이 오면 그대로 뜬다 — **지금은 영영 안 뜬다.** BPM·곡 길이·누적 재생은 잘 온다 | 협의 전 — BE 요청 필요 |
| A-34 | ~~비 ASCII(한글) 닉네임을 거부한다~~ **재현되지 않음 — 취소** | `PATCH /api/user/profile` · `GET /api/users/nickname-available` | — | 2026-09-18 15:1x 에 한글 닉네임이 `PATCH /api/user/profile` 에서 `400 INVALID_INPUT`, 중복확인에서 500 으로 보여 검증 정규식이 ASCII 전용이라고 적었다. **같은 날 16:0x 재확인 결과 전부 정상이다**: `별하나` 저장 200, `테스트닉`·`별하나둘` 중복확인 200. 그 사이에 user 테이블을 타는 엔드포인트가 전부 500 이 되는 장애가 있었으므로(그때는 `/api/music/major` 까지 500), **처음 관찰은 그 장애 구간에 걸린 것으로 본다.** 백엔드 쪽에 할 일 없음 — 기록만 남긴다. 다시 보이면 이 항목을 되살린다 | 취소 (2026-09-18 재확인) |
| A-35 | **마이페이지·프로필에 필요한 값이 배포 API 에 없다** | `GET /api/user/detail?email=` | 지금: email·name·nickname·isPublic·tutorialCompleted·lastActiveAt·createdAt·imageUrl·followerCnt·followingCnt·isFollowing·isMe | 프론트 `UserProfile`(USER-02/04) 이 쓰는 값 중 **다음이 아예 없다**: 지금 듣는 곡(`nowPlaying`), 나와 만난 횟수(`meetingCount`), 따라가는 대상(`followingTarget`), 대시보드 통계(탐험한 곡 수·발견한 곡 수·선호 분위기), 온라인 여부. **팔로우·반응 API 자체도 배포 스펙 34개 경로에 없다** (`/api/user/{email}/follow` 계열). 2026-09-18 실연동 때 목으로 채우지 않고 **빈 값으로 뒀다** — 목을 섞으면 실데이터인 줄 알고 보게 된다. 그래서 지금 마이페이지 대시보드는 0 으로 보인다. 온라인 여부만 `lastActiveAt` 이 5분 이내면 접속 중으로 **가늠해서** 쓴다(`toUserProfile`). 소켓 접속자 목록이 생기면 그걸로 바꾼다. `updatedAt` 도 응답에 없어서 프론트 타입을 nullable 로 바꿨다 | 요청됨 (2026-09-18, S15P21A405-462) |
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

---

## 4. 실시간(소켓) 필요 항목

| # | 내용 | 이유 | 상태 |
| --- | --- | --- | --- |
| S-1 | 따라가기 동기화 — 인솔자의 동작을 **세 종류 이벤트로 따로** 보내야 한다 (SOCIAL-07): ① `leader:view` = 곡 클릭(`viewingMusicId`) ② `leader:play` = 재생 시작(`playingMusicId`) ③ `leader:layer` = 레이어 전환(`layer`) | 뷰는 ①에서 먼저 움직이고, 우주선은 ②가 와야 출발한다. 두 개를 한 이벤트로 합쳐 보내면 이 연출이 불가능하다 | 협의 전 |
| S-2 | 따라가기 자동 종료: 인솔자 접속 종료·비공개 전환 시 (SOCIAL-10-1) | 서버가 알려줘야 한다 | 협의 전 |
| S-3 | 접속 상태·현재 탐색 좌표 실시간 관리 (USER-03) | 주변 사람 목록의 실시간성 | 협의 전 |
| S-4 | 반응 전송·수신 (SOCIAL-02, SOCIAL-04 쿨다운) | 같은 영역 사용자에게 즉시 전달 | 협의 전 |
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
