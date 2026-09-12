# ODY API 명세서 v1.0

> 출처: Notion 「ODY api 명세서 최종」(정본). 정본은 Notion이며, 이 문서는 스냅샷이다.
> 상위 「API 명세서(수정중)」의 개별 API 페이지와 차이가 있으면 **이 정본이 우선**한다.

> ## ⚠️ 스냅샷 선행 갱신 (2026-09-11) — Notion 미반영
>
> **§3.4 와 §0.6 의 `MapPoint` 항목은 이 스냅샷에서 먼저 갱신됐고 Notion 정본에는 아직 없다.**
> 위의 "정본(Notion) 우선" 규칙과 충돌하므로 **해당 두 곳에 한해 이 스냅샷을 따른다.**
>
> | | |
> |---|---|
> | 무엇 | `GET /api/music/major` 의 요청·응답·선정 책임(§3.4), 공통 DTO `MapPoint` 신설(§0.6) |
> | 왜 | 구현이 원안과 호환 불가하게 갈라졌다. 헌법 II — "경계를 넘는 변경은 **구현 전에** 계약을 갱신해야 한다(MUST)" |
> | 근거 | 결정 D15~D19. `specs/001-pc-major-tracks/spec.md` 의 Clarifications 절 |
> | 원안 | 같은 파일 "대체된 요구사항 — 롤백 기록" 절에 **전문 보존**. 롤백 조건도 거기 있다 |
> | 합의 | FE1 확인 완료(2026-09-11). data 인프라(스펙 16·18)가 이 모델로 이미 구축됨 |
> | 이슈 | S15P21A405-50 · 태스크 T036 |
>
> **남은 일: Notion 정본에 이 내용을 옮겨야 한다. 옮긴 뒤 이 블록을 지운다.**
> 그 전까지 Notion 만 보고 구현하면 어긋난다.

## 0. 공통 사항

### 0.1 기본 정보

| 항목 | 값 |
|---|---|
| Base URL | `https://{host}` |
| Content-Type | `application/json; charset=UTF-8` (파일 업로드는 `multipart/form-data`) |
| 인증 헤더 | `Authorization: Bearer {accessToken}` |
| 시간 포맷 | ISO-8601 (`2026-09-07T14:03:11+09:00`) |
| 네이밍 | 요청/응답 필드는 **camelCase** 통일 |

### 0.2 응답 포맷

성공:
```json
{ "success": true, "data": { }, "error": null }
```
실패:
```json
{ "success": false, "data": null, "error": { "code": "TRACK_NOT_PLAYABLE", "message": "미리듣기 링크가 없는 곡입니다." } }
```
- 반환할 데이터가 없는 API(로그아웃, 탈퇴 등)는 `"data": null`.
- 목록 API는 `data` 안에 `content` 배열 + 페이지 정보.

### 0.3 페이지네이션 규약

요청: `page` (int, required, 기본 0, 0-based).

응답:
```json
{ "success": true, "data": { "content": [], "page": 0, "size": 20, "totalElements": 137, "totalPages": 7, "hasNext": true }, "error": null }
```
- 페이지 크기는 서버에서 **10 고정**. 응답 `size`는 클라이언트 하드코딩 방지용 참고값.

### 0.4 HTTP 상태 코드 매핑

| 상태 | 사용 상황 |
|---|---|
| 200 OK | 조회/수정/삭제 성공 |
| 201 Created | 리소스 생성 성공 (플레이리스트 생성 등) |
| 400 Bad Request | 파라미터 검증 실패 |
| 401 Unauthorized | 토큰 없음/만료/위조 |
| 403 Forbidden | 권한 없음 (타인 리소스 접근) |
| 404 Not Found | 리소스 없음 |
| 409 Conflict | 중복 (이미 팔로우 등) |
| 422 Unprocessable Entity | 요청은 유효하나 처리 불가 (경로 탐색 실패 등) |
| 500 Internal Server Error | 서버 오류 |

실패 시에도 body는 항상 0.2 공통 실패 포맷.

### 0.5 에러 코드

| code | HTTP | message 예시 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 필수 파라미터가 누락되었습니다. |
| `INVALID_TOKEN` | 401 | 유효하지 않은 토큰입니다. |
| `TOKEN_EXPIRED` | 401 | 액세스 토큰이 만료되었습니다. |
| `REFRESH_TOKEN_INVALID` | 401 | 리프레시 토큰이 유효하지 않거나 만료되었습니다. |
| `OAUTH_FAILED` | 401 | 구글 인증에 실패했습니다. |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호가 올바르지 않습니다. (§1.4, 이메일 없음/OAuth 전용 계정) |
| `PASSWORD_MISMATCH` | 401 | 비밀번호가 올바르지 않습니다. (§1.4, 이메일은 존재하나 비밀번호 틀림) |
| `INVALID_PASSWORD_FORMAT` | 400 | 비밀번호는 영문과 숫자를 포함해 8~72자여야 합니다. (§1.4) |
| `INVALID_NICKNAME_LENGTH` | 400 | 닉네임은 2~20자여야 합니다. (§1.4) |
| `EMAIL_ALREADY_EXISTS` | 409 | 이미 가입된 이메일입니다. (§1.4) |
| `NICKNAME_ALREADY_EXISTS` | 409 | 이미 사용 중인 닉네임입니다. (§1.4) |
| `FORBIDDEN` | 403 | 접근 권한이 없습니다. |
| `USER_NOT_FOUND` | 404 | 존재하지 않는 사용자입니다. |
| `USER_PRIVATE` | 403 | 비공개 사용자입니다. |
| `MUSIC_NOT_FOUND` | 404 | 존재하지 않는 곡입니다. |
| `TRACK_NOT_PLAYABLE` | 422 | 미리듣기 링크가 없는 곡입니다. |
| `PATH_NOT_FOUND` | 422 | 두 곡을 연결하는 경로를 찾을 수 없습니다. |
| `PLAYLIST_NOT_FOUND` | 404 | 존재하지 않는 플레이리스트입니다. |
| `PLAYLIST_NAME_DUPLICATED` | 409 | 같은 이름의 플레이리스트가 이미 있습니다. |
| `ALREADY_FOLLOWING` | 409 | 이미 팔로우한 사용자입니다. |
| `SELF_FOLLOW_NOT_ALLOWED` | 400 | 자신을 팔로우할 수 없습니다. |
| `UNSUPPORTED_FILE_TYPE` | 400 | 지원하지 않는 이미지 형식입니다. |
| `FILE_TOO_LARGE` | 400 | 파일 용량이 너무 큽니다. |
| `INTERNAL_ERROR` | 500 | 서버 오류가 발생했습니다. |

### 0.6 공통 DTO

**MusicSummary** (검색 결과 / 주변곡 / 경로 노드): `id`(int), `title`(string), `artist`(string), `album`(string\|null), `genres`(list\|string\|null), `youtubeUrl`(string\|null, null이면 재생 불가), `location`(Location).

**Location**: `pc1`~`pc16` (각 float).

**MusicDetail** = MusicSummary + `mbid`, `bpm`(float), `duration`(int, 초), `playCnt`(int), `youtubeCnt`(int).

**MapPoint** (지도 레이어 상주 집합 — §3.4 전용. ⚠️ 2026-09-11 스냅샷 선행 갱신, Notion 미반영): `musicId`(int), `pc`(float 16개 **배열**), `genreId`(int, **비음수**), `weight`(int, 별 크기·클라이언트 선별용), `title`(string), `artist`(string\|null), `playable`(boolean, 재생 링크 유무).
좌표를 `Location` 객체가 아니라 배열로 싣는 유일한 DTO다 — 클라이언트가 레이어 축 `pc(2n-1)`·`pc(2n)` 으로 재투영하기 때문.

**PlaylistTrack**: `id`(int, 곡 ID), `title`, `artist`, `duration`(int, 초), `youtubeUrl`(string\|null).

**UserSummary** (사용자 검색 / 팔로우 목록): `email`, `name`(구글 이름), `nickname`(string\|null), `imageUrl`(string\|null), `isPublic`(boolean), `isFollowing`(boolean, 요청자가 이 사용자를 팔로우 중인지).

### 0.7 인증 및 본인 식별 규칙

- 인증 필요 API는 `Authorization: Bearer {accessToken}` 요구.
- **본인 대상 API는 `email`을 받지 않음** — 서버가 토큰 subject에서 본인 email 추출.
  - 해당: `auth/logout`, `user/update`, `user/ispublic`, `user/delete`, `user/follow/insert`, `user/follow/delete`, `playlist/create`
  - 이유: body의 email을 신뢰하면 남의 email만 알아도 정보 수정·탈퇴 가능. 파라미터 자체 제거.
- **타인 조회 API는 `email` 유지** — `user/detail`, `user/follow/list`, `playlist/search`
- 소유 리소스 ID 접근 API(`playlist/detail`, `playlist/update`, `playlist/delete`, `playlist/music/*`)는 서버가 `playlist.ownerEmail == token.email` 검증, 불일치 시 `FORBIDDEN`.

---

## 1. 인증 / 회원

### 1.1 구글 OAuth 로그인
`POST /auth/login/google` · 인증 불필요. 프론트에서 Google Identity Services로 `idToken`을 받아 서버에 전달하는 **토큰 검증 방식**(본안). **S15P21A405-122에서 구현 완료**, 실제 경로는 이 저장소 컨벤션에 맞춰 `POST /api/auth/login/google`이다.

body: `idToken`(String, required).
```json
{ "success": true, "data": {
  "accessToken": "...",
  "user": { "email": "user@gmail.com", "name": "홍길동", "nickname": null, "imageUrl": "https://lh3..." }
}, "error": null }
```
- 정본과 실제 구현의 차이: `refreshToken`은 body가 아니라 httpOnly 쿠키로 내려간다(exchange/reissue와 동일 컨벤션, 탈취 위험 감소). `accessTokenExpiresIn`, `isNewUser`는 응답에 없다(온보딩 분기 신호는 팀 결정으로 쓰지 않기로 함).
- idToken 검증은 Google 공식 라이브러리(`GoogleIdTokenVerifier`)로 서명·발급자·audience(`GOOGLE_CLIENT_ID`)·만료를 확인한다. `email_verified=false`인 idToken도 거부한다. 에러: `OAUTH_FAILED`.
- 대안(서버 리다이렉트, Spring Security OAuth2 Client, 기존 그대로 유지): `GET /oauth2/authorization/google` → 동의 화면, `GET /login/oauth2/code/google` → 콜백, 성공 시 `{FRONTEND_OAUTH_REDIRECT_URI}?code=...`로 302, 프론트가 `POST /api/auth/exchange`로 code를 accessToken과 교환(§1.4 참고 경로들과 동일 컨벤션).

### 1.2 토큰 재발급
`POST /auth/refresh` · 인증 불필요(refreshToken으로 검증). body: `refreshToken`(String, required).
```json
{ "success": true, "data": { "accessToken": "...", "refreshToken": "...", "accessTokenExpiresIn": 1800 }, "error": null }
```
- 재발급 시 refreshToken도 교체(rotation), 기존 토큰 무효화. 에러: `REFRESH_TOKEN_INVALID`.

### 1.3 로그아웃
`POST /auth/logout` · 인증 필요. header: `Authorization`. res: `{ "success": true, "data": null, "error": null }`.
- 서버는 토큰 주체의 refreshToken 폐기, 별도 body/param 없음. 에러: `INVALID_TOKEN`, `TOKEN_EXPIRED`.

### 1.4 이메일/비밀번호 회원가입·로그인 (S15P21A405-121)
> Notion 정본(AUTH-01)은 소셜 로그인만 확정돼 있다. 아래 두 API는 Notion에 없는, 백엔드 담당자 판단으로 추가한
> 범위 변경이다(`S15P21A405-120`에 기록된 "명세 충돌 — 기획 확인 필요" 메모 참고). 실제 구현 경로 기준으로 적는다
> (§1.1~1.3의 `/auth/*`와 달리 이 저장소의 실제 `AuthController`는 `/api/auth/*` 접두사를 쓴다 — 기존부터 있던
> 정본과 코드의 경로 불일치이며 이번 작업 범위에서 고치지 않았다).

`POST /api/auth/signup` · 인증 불필요. body: `email`(String, required), `password`(String, required, 영문+숫자
포함 8자 이상, UTF-8 72바이트 이하), `nickname`(String, required, 2~20자).
```json
{ "success": true, "data": { "accessToken": "..." }, "error": null }
```
- 응답 모양은 1.1/1.2의 exchange·reissue와 동일(accessToken만 body, refreshToken은 httpOnly 쿠키).
- 비밀번호는 bcrypt로 해시해 `"user".password_hash`에 저장. `name` 컬럼은 NOT NULL이라 `nickname` 값을 그대로 채운다.
- password/nickname의 형식·길이 검증은 Bean Validation이 아니라 서비스 레이어에서 하며, 필수값 누락만 공통
  `VALIDATION_ERROR`(400)이고 형식·길이·중복은 아래 전용 코드를 쓴다.
- 에러: `INVALID_PASSWORD_FORMAT`(400), `INVALID_NICKNAME_LENGTH`(400), `EMAIL_ALREADY_EXISTS`(409),
  `NICKNAME_ALREADY_EXISTS`(409), `VALIDATION_ERROR`(400, 필수값 누락).

`POST /api/auth/login` · 인증 불필요. body: `email`(String, required), `password`(String, required).
```json
{ "success": true, "data": { "accessToken": "..." }, "error": null }
```
- 이메일이 없거나 구글 OAuth 전용 계정(`password_hash IS NULL`)이면 `INVALID_CREDENTIALS`(401) — 계정 존재
  여부를 노출하지 않는다. 이메일은 존재하는데 비밀번호만 틀리면 `PASSWORD_MISMATCH`(401)로 구분한다.
- 에러: `INVALID_CREDENTIALS`(401), `PASSWORD_MISMATCH`(401), `VALIDATION_ERROR`(400).
- 선행 조건: `"user".password_hash` 컬럼 추가 필요(아래 쿼리 참고, 아직 실행 안 됨).
  ```sql
  ALTER TABLE "user" ADD COLUMN IF NOT EXISTS password_hash varchar(60);
  ```

`GET /api/users/nickname-available` · 인증 불필요(가입 전 호출). param: `nickname`(String, required).
```json
{ "success": true, "data": { "available": true }, "error": null }
```
- `signup`과 같은 길이 규칙(2~20자, `NicknamePolicy`)과 같은 중복 검사(`existsByNickname`)를 그대로 재사용한다.
  이 API가 `available:true`를 반환해도 그 사이 다른 요청이 먼저 가입하면 `signup`에서 `NICKNAME_ALREADY_EXISTS`가
  날 수 있다(TOCTOU, 최종 검증은 signup 쪽).
- 에러: `INVALID_NICKNAME_LENGTH`(400), `VALIDATION_ERROR`(400, 필수값 누락).
- 경로가 `/api/users`(복수, api 접두사)로, 이 저장소의 다른 컨트롤러(`/user/detail`, `/playlist/detail`)나
  `/api/auth/*`와도 다른 세 번째 네이밍이다. 사용자가 지정한 경로를 그대로 따랐다.

### 1.5 온보딩 완료 처리 (S15P21A405-122)
`PATCH /api/user/tutorial-completed` · 인증 필요. 토큰 주체 본인만 대상이라 email을 받지 않는다(§0.7 본인 대상 API 규칙).
```json
{ "success": true, "data": { "tutorialCompleted": true }, "error": null }
```
- `"user".tutorial_completed`를 true로 전환한다. 이미 true여도 멱등하게 200.
- 로그인 응답(§1.1, §1.4)에는 `isNewUser` 같은 신호가 없다 — 온보딩 완료 여부를 프론트가 알아야 하면
  `GET /user/detail`의 `tutorialCompleted` 필드를 조회해서 판단한다.
- 경로가 `/api/user`(단수, api 접두사)로, `/user/detail`·`/api/users/*`·`/api/auth/*`와도 다른 네 번째
  네이밍이다 — 이 저장소에 경로 접두사 컨벤션이 아직 통일되지 않았다는 뜻이므로 정리가 필요하다.

---

## 2. 사용자

### 2.1 사용자 상세 조회
`GET /user/detail` · 인증 필요. param: `email`(String, required).
```json
{ "success": true, "data": {
  "email": "user@gmail.com", "name": "홍길동", "nickname": "길동무", "isPublic": true,
  "tutorialCompleted": true,
  "lastActiveAt": "2026-09-07T13:41:02+09:00", "createdAt": "2026-08-21T09:12:44+09:00",
  "imageUrl": "https://cdn.example.com/profile/abc.png",
  "followerCnt": 12, "followingCnt": 8, "isFollowing": false, "isMe": false
}, "error": null }
```
- 본인 프로필도 이 API로 조회(본인 email → `isMe: true`). `isFollowing`은 토큰 주체가 조회 대상을 팔로우 중인지. 에러: `USER_NOT_FOUND`, `USER_PRIVATE`.
- 구현 메모(S15P21A405-70): `followerCnt`/`followingCnt`/`isFollowing`은 팔로우 MVP 범위 확정(E1) 전까지 서버가 0/0/false 고정값을 반환한다.

### 2.2 사용자 수정 (프로필)
정본은 `PATCH /user/update`(multipart, 이미지 파일 업로드)를 명세하지만, 이 저장소에는 이미지 업로드
인프라(스토리지·MultipartFile 처리)가 없어 아래와 같이 JSON body로 구현했다(S15P21A405-216).

`PATCH /api/user/profile` · 인증 필요 · `application/json`. body: `nickname`(String, opt), `imageUrl`(String, opt).
```json
{ "success": true, "data": { "nickname": "새닉네임", "imageUrl": "https://cdn.example.com/profile/abc.png" }, "error": null }
```
- 대상은 토큰 주체(`email` 안 받음). 요청에 포함된 필드만 갱신하고 미전달 필드는 기존 값 유지(PATCH).
  둘 다 없으면 `INVALID_INPUT`. 닉네임은 `signup`/닉네임 사용 가능 여부 조회와 같은 길이 규칙(`NicknamePolicy`)을
  적용하되, 현재 값과 동일한 닉네임을 다시 보내는 것은 중복으로 취급하지 않는다.
- 에러: `INVALID_INPUT`(400, 둘 다 미전달), `INVALID_NICKNAME_LENGTH`(400), `NICKNAME_ALREADY_EXISTS`(409), `USER_NOT_FOUND`(404).
- `is_public`(§2.3)과 `tutorial_completed`(§1.5)는 이 API에서 다루지 않는다 — 전자는 실시간 노출 범위와
  얽혀 있고(S15P21A405-72), 후자는 온보딩 1회성 상태 전이라 의미가 달라 별도 엔드포인트로 유지한다.

### 2.3 공개 여부 변경
`PATCH /user/ispublic` · 인증 필요. body: `isPublic`(boolean, required).
```json
{ "success": true, "data": { "email": "user@gmail.com", "isPublic": false }, "error": null }
```
- 대상은 토큰 주체. 응답에 변경 결과 포함. 에러: `USER_NOT_FOUND`.

### 2.4 탈퇴
`DELETE /user/delete` · 인증 필요 · param/body 없음(토큰 주체가 대상). res: `{ "success": true, "data": null, "error": null }`.
- 처리 순서: refreshToken 폐기 → 팔로우 관계 삭제 → 플레이리스트 삭제 → 사용자 레코드 처리. 에러: `USER_NOT_FOUND`.

### 2.5 팔로우 추가
`POST /user/follow/insert` · 인증 필요. body: `followeeEmail`(String, required).
```json
{ "success": true, "data": { "followerEmail": "me@gmail.com", "followeeEmail": "you@gmail.com", "isFollowing": true, "followeeFollowerCnt": 13 }, "error": null }
```
- `followerEmail`은 토큰 주체(요청 미포함, 응답에만). 에러: `USER_NOT_FOUND`, `ALREADY_FOLLOWING`, `SELF_FOLLOW_NOT_ALLOWED`.

### 2.6 팔로우 삭제
`POST /user/follow/delete` · 인증 필요. body: `followeeEmail`(String, required).
```json
{ "success": true, "data": { "followerEmail": "me@gmail.com", "followeeEmail": "you@gmail.com", "isFollowing": false, "followeeFollowerCnt": 12 }, "error": null }
```
- 이미 팔로우 아니어도 200(멱등). 에러: `USER_NOT_FOUND`.

### 2.7 사용자 검색
`GET /user/search` · 인증 필요. param: `query`(String, required), `page`(int, required, 0).
```json
{ "success": true, "data": { "content": [ { "email": "you@gmail.com", "name": "김철수", "nickname": "철수형", "imageUrl": "https://...", "isPublic": true, "isFollowing": false } ], "page": 0, "size": 20, "totalElements": 3, "totalPages": 1, "hasNext": false }, "error": null }
```
- 닉네임 부분 일치. 결과 없음은 빈 content+200. 토큰 주체 본인 제외. 비공개 사용자도 검색 결과엔 노출(상세 진입 시 `USER_PRIVATE`). 에러: `VALIDATION_ERROR`.

### 2.8 팔로워 / 팔로잉 목록 조회
`GET /user/follow/list` · 인증 필요. param: `email`(required), `type`(required, `follower`/`following`), `page`(required, 0).
```json
{ "success": true, "data": { "type": "following", "content": [ { "email": "you@gmail.com", "name": "김철수", "nickname": "철수형", "imageUrl": "https://...", "isPublic": true, "isFollowing": true, "lastActiveAt": "2026-09-07T11:20:31+09:00" } ], "page": 0, "size": 20, "totalElements": 8, "totalPages": 1, "hasNext": false }, "error": null }
```
- `isFollowing`은 목록 소유자가 아니라 **토큰 주체 기준**. 에러: `USER_NOT_FOUND`, `USER_PRIVATE`, `VALIDATION_ERROR`.

---

## 3. 음악  *(BE2 효정 담당)*

> 경로는 `/api/music/*` (S15P21A405-213). 이 저장소의 `/api/auth/*`·`/api/users/*` 컨벤션과 프론트 `api-endpoints.ts` 에 맞춘 것으로, 정본 v1.0 의 `/music/*` 표기를 대체한다.

### 3.1 노래 검색
`GET /api/music/search` · 인증 필요. param: `query`(String, required), `page`(int, required, 0).
```json
{ "success": true, "data": { "content": [ {
  "id": 10234, "title": "Love wins all", "artist": "IU", "album": "The Winning",
  "genres": ["K-Pop"], "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
  "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 }
} ], "page": 0, "size": 20, "totalElements": 137, "totalPages": 7, "hasNext": true }, "error": null }
```
- 결과 없음은 빈 content+200. 에러: `VALIDATION_ERROR`.
- **정렬은 관련성 순**: 제목 완전일치 → 제목 앞일치 → 아티스트 완전일치 → 아티스트 앞일치 → 나머지 부분일치. 같은 순위 안에서는 `id` 오름차순. 대소문자 구분 없음 (2026-09-12 변경, S15P21A405-234 — 이전은 `youtubeCnt` 내림차순이었으나 값이 전 행 0 이라 무작위였다).

### 3.2 노래 상세 조회
`GET /api/music/detail` · 인증 필요. param: `id`(int, required).
```json
{ "success": true, "data": {
  "id": 10234, "mbid": "b1a9c0e9-d987-4042-ae91-78d6a3267d69", "title": "Love wins all", "artist": "IU",
  "bpm": 128.4, "duration": 275, "album": "The Winning", "genres": ["K-Pop"],
  "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
  "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 },
  "playCnt": 1428, "youtubeCnt": 3,
  "neighbors": [ {
    "id": 10877, "title": "Through the Night", "artist": "IU", "album": "Palette", "genres": ["K-Pop"],
    "youtubeUrl": "https://www.youtube.com/watch?v=BzYnNdJhZQw",
    "location": { "pc1": -0.3980, "pc2": 1.1204, "...": "...", "pc16": -0.098 }, "distance": 0.0412
  } ]
}, "error": null }
```
- `neighbors`는 임베딩 공간 최근접 10곡, `distance` 오름차순. 자기 자신 제외. 재생 불가(`youtubeUrl == null`) 곡도 포함. 거리 척도는 서빙 baseline(`v2.1-pca16`) 기준. 에러: `MUSIC_NOT_FOUND`.

### 3.3 경로 탐색
`GET /api/music/journey` · 인증 필요. param: `start`(int, required, 시작곡 ID), `end`(int, required, 끝곡 ID).
```json
{ "success": true, "data": {
  "musicCnt": 14, "totalDuration": 3480,
  "path": [ {
    "step": 0, "id": 10234, "mbid": "b1a9c0e9-...", "title": "Love wins all", "artist": "IU",
    "bpm": 128.4, "duration": 275, "album": "The Winning", "genres": ["K-Pop"],
    "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
    "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 }, "playCnt": 1428, "youtubeCnt": 3
  } ]
}, "error": null }
```
- `path`는 시작곡을 `step: 0`으로 포함하고 끝곡까지 순서대로 나열.
- `path`는 출발곡·도착곡 포함 **최대 30곡**. 초과 경로는 서버가 30곡 이하로 줄인 뒤 최종 목록 기준으로 곡 간 도약을 재평가.
- `totalDuration`은 경로 내 모든 곡 `duration` 합(초).
- 중간 지점: 출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택. 거리 척도는 baseline(`v2.1-pca16`).
- 경계: `start == end` → path에 해당 곡 1개(`step:0`), `musicCnt:1`, 200 / 재생 불가 곡도 포함, 연결 경로 없으면 `PATH_NOT_FOUND`.
- 에러: `MUSIC_NOT_FOUND`(없는 곡), `PATH_NOT_FOUND`(경로 연결 불가).

### 3.4 대표곡 조회
> ⚠️ **2026-09-11 개정 · 스냅샷 선행(Notion 미반영).** 아래 "변경 이력" 참조.
> 절 이름과 경로(`/api/music/major`)는 참조 깨짐을 피하려고 **그대로 둔다** — 서버가 대표곡을 고르지 않게 된 뒤에도
> 이름이 `major` 인 것은 역사적 잔재다.

`GET /api/music/major` · 인증 필요. 지도 레이어(`level`)와 이전 겹들에서 좁힌 누적 범위로 그 레이어에 **상주하는 곡 집합**을 반환. 레이어 n 은 평면 `pc(2n-1)`·`pc(2n)` 을 축으로 씀.

param: `level`(int, required), 누적 축 범위(level ≥ 2 에서 required, 레이어 1..level-1 각각의 min·max 쌍).
```json
{ "success": true, "data": { "content": [ {
  "musicId": 10234,
  "pc": [-0.4213, 1.0872, "...", -0.123],
  "genreId": 0, "weight": 0,
  "title": "Love wins all", "artist": "IU", "playable": false
} ] }, "error": null }
```
- `level = 1`(최상위)은 범위 없이 호출. 서버가 미리 계산한 정적 결과를 반환.
- 누적 범위는 **클라이언트가 캐싱해 전부 전달**. 서버는 탐색 상태를 보관하지 않으며 요청 하나로 완결됨. 레이어를 올라가면 클라이언트가 해당 범위를 폐기.
- **선정 책임 분리**: 서버는 상주 집합을 공간적으로 고르게 뽑음. 인기순 대표 선별은 클라이언트가 화면 픽셀 격자에서 수행 — 격자가 줌에 따라 변해 서버가 적용할 수 없음.
- 반환 개수는 1,000 **규모**. 정확한 수는 강제하지 않음.
- 상세 필드(`bpm`·`duration`·`album`·`genres`·`mbid`·`playCnt`·`youtubeCnt`)는 담지 않음 — §3.2 담당.
- 에러: `VALIDATION_ERROR`.

**미정**: 범위 파라미터의 이름·표기는 FE 구현 시 확정(후보 `pc{n}min`·`pc{n}max`). `genreId` 의 무장르 인덱스 번호와 멜론 코드 29종 → 색 인덱스 매핑은 FE 통보 대기.

**현재 데이터 상태**(계약이 아니라 사실): `weight` 는 인기 지표 부재로 균일값, `playable` 은 `youtube_url` 미수집이라 전부 false.

#### 변경 이력 — 2026-09-11 (D15~D19, 이슈 S15P21A405-50)

| | 원안 (~2026-09-10) | 개정 |
|---|---|---|
| 요청 | `level` + 중심좌표 `pc1`~`pc16` | `level` + **누적 축 범위**(1레이어는 파라미터 없음) |
| 조회 구역 | 서버가 레벨별 **반경**으로 정하는 **원형** | **격자**. 구역 선택·이동은 **클라이언트 뷰포트** |
| 선정 | 서버가 `youtubeCnt` **내림차순 상위 k** | 서버는 **공간 균등 상주 집합**, 인기순은 **클라이언트** |
| 응답 | `MusicDetail` (12필드, `location` 객체) | **`MapPoint`** (7필드, `pc` 배열) |
| 1레이어 | 다른 레벨과 동일 처리 | **정적 사전 계산** |

**왜**: FE 가 이 모델로 이미 구현했고(`map-engine.ts`), data 가 거기 맞춰 인프라를 만들었으며(스펙 16 `map_sample`·GiST),
1레이어 전역 실시간 집계가 **20,941 ms** 로 측정돼 정적화 없이는 첫 화면이 성립하지 않는다.

**원안 전문과 롤백 조건**: `specs/001-pc-major-tracks/spec.md` 의 "대체된 요구사항 — 롤백 기록" 절.
인기 지표가 확보되거나 고정 격자의 시각적 문제가 드러나면 재검토 대상이다.

---

## 4. 플레이리스트

> **S15P21A405-65/66/67에서 구현 완료**. `playlist`, `playlist_item` 테이블은 데이터 파트에서 이미 만들었다
> (아래가 실제 운영 스키마). 컬럼명이 `owner_email`/`name`이 아니라 `email`/`playlist_name`이고, `id`는
> 자동증가가 아니라 애플리케이션이 시퀀스로 채운다.
> ```sql
> CREATE TABLE public.playlist (
>     id int8 NOT NULL,
>     email varchar(255) NOT NULL,
>     playlist_name varchar(200) NOT NULL,
>     like_cnt int4 NULL,
>     created_at timestamptz DEFAULT now() NOT NULL,
>     updated_at timestamptz DEFAULT now() NOT NULL,
>     CONSTRAINT "PK_PLAYLIST" PRIMARY KEY (id)
> );
>
> CREATE TABLE public.playlist_item (
>     playlist_id int8 NOT NULL,
>     music_id int8 NOT NULL,
>     added_at timestamptz DEFAULT now() NOT NULL,
>     CONSTRAINT "PK_PLAYLIST_ITEM" PRIMARY KEY (playlist_id, music_id),
>     CONSTRAINT "FK_music_TO_playlist_item_1" FOREIGN KEY (music_id) REFERENCES public.music(id),
>     CONSTRAINT "FK_playlist_TO_playlist_item_1" FOREIGN KEY (playlist_id) REFERENCES public.playlist(id)
> );
> ```
> **아직 실행 안 된, 백엔드가 추가로 필요한 것 두 가지**:
> ```sql
> -- 1) playlist.id 채번용 — 테이블에 DEFAULT/시퀀스가 없다.
> CREATE SEQUENCE IF NOT EXISTS playlist_id_seq OWNED BY public.playlist.id;
>
> -- 2) 곡 순서 변경(4.4.1) 저장용 — 원본 테이블엔 순서 컬럼이 없어서 추가하기로 결정(팀 확인 완료).
> ALTER TABLE public.playlist_item ADD COLUMN position int4 NOT NULL DEFAULT 0;
> CREATE INDEX idx_playlist_item_order ON public.playlist_item (playlist_id, position);
> ```
> `like_cnt`는 현재 API 어디에도 노출·수정하지 않는다(좋아요 기능 자체가 아직 없음).
>
> **곡 조회 선행 조건**: 곡 존재 확인·상세 조회는 `MusicDetailReader` 포트를 그대로 재사용하는데, 이 포트는 아직
> 어댑터(BE4)가 없다(`MusicService`와 동일한 "대기 중" 상태). `music` 테이블 자체는 이제 있지만(위 FK로 확인),
> 애플리케이션에서 그 테이블을 읽는 코드가 아직 없다는 뜻이다. 그 결과 지금 시점에는:
> - `musicIdList`가 **빈 배열**인 `/playlist/create`, `/playlist/detail`(빈 플레이리스트)은 정상 동작한다.
> - `musicIdList`에 실제 곡 ID가 하나라도 들어가는 모든 API(4.2 트랙 있는 상세, 4.3 비어있지 않은 생성, 4.4 곡 추가,
>   §4의 나머지 곡 관련 호출)는 어댑터가 붙기 전까지 500(`UnsupportedOperationException`)이 난다.
>
> `FORBIDDEN`은 신규 공통 에러코드(`GlobalErrorCode`, 403)로 이번에 추가했다.

### 4.1 플레이리스트 목록 조회
`GET /playlist/search` · 인증 필요. param: `email`(String, required, 소유자).
```json
{ "success": true, "data": { "content": [ { "playlistId": 42, "playlistName": "새벽 드라이브", "musicCnt": 18, "createdAt": "2026-08-30T22:10:00+09:00" } ] }, "error": null }
```
- 본인 목록도 이 API(email에 본인 email). 에러: `USER_NOT_FOUND`, `USER_PRIVATE`.

### 4.2 플레이리스트 상세 조회
`GET /playlist/detail` · 인증 필요. param: `playlistId`(int, required).
```json
{ "success": true, "data": {
  "playlistId": 42, "playlistName": "새벽 드라이브", "musicCnt": 2, "totalDuration": 512,
  "musics": [ { "id": 10234, "mbid": "...", "title": "Love wins all", "artist": "IU", "bpm": 128.4, "duration": 275, "album": "The Winning", "genres": ["K-Pop"], "youtubeUrl": "https://...", "location": { "pc1": -0.4213, "...": "...", "pc16": -0.123 }, "playCnt": 1428, "youtubeCnt": 3 } ]
}, "error": null }
```
- `youtubeUrl`이 null인 곡은 클라이언트에서 재생 불가로 표시. 에러: `PLAYLIST_NOT_FOUND`, `FORBIDDEN`.

### 4.3 플레이리스트 생성
`POST /playlist/create` · 인증 필요. body: `playlistName`(String, required), `musicIdList`(Array\<int\>, required, 빈 배열 허용). res 201:
```json
{ "success": true, "data": { "playlistId": 43, "playlistName": "출근길", "musicCnt": 12 }, "error": null }
```
- 소유자는 토큰 주체(email 안 받음). 에러: `VALIDATION_ERROR`, `MUSIC_NOT_FOUND`, `PLAYLIST_NAME_DUPLICATED`.

### 4.4 기존 플레이리스트에 곡 추가
`POST /playlist/music/insert` · 인증 필요. body: `playlistId`(int, required), `musicIdList`(Array\<int\>, required).
```json
{ "success": true, "data": { "playlistId": 42, "insertedCnt": 3, "skippedCnt": 1, "skippedMusicIds": [10877], "musicCnt": 21 }, "error": null }
```
- 이미 담긴 곡은 에러 대신 skipped로 부분 성공 처리. 에러: `PLAYLIST_NOT_FOUND`, `MUSIC_NOT_FOUND`, `FORBIDDEN`.

### 4.4.1 플레이리스트 곡 순서 변경 (S15P21A405-66, 정본에는 없는 신규 엔드포인트)
`POST /playlist/music/reorder` · 인증 필요. body: `playlistId`(int, required), `musicIdList`(Array\<int\>, required).
```json
{ "success": true, "data": { "playlistId": 42, "musicCnt": 19 }, "error": null }
```
- `musicIdList`는 곡 추가·삭제 없이 **현재 담긴 곡과 정확히 같은 집합**을 새 순서로 나열한 것이어야 한다. 집합이
  다르면(곡이 빠지거나 추가되면) `INVALID_INPUT`(400). 추가/삭제는 4.4/4.5로 따로 한다.
- 에러: `PLAYLIST_NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`.

### 4.5 플레이리스트에서 곡 삭제
`POST /playlist/music/delete` · 인증 필요. body: `playlistId`(int, required), `musicIdList`(Array\<int\>, required).
```json
{ "success": true, "data": { "playlistId": 42, "deletedCnt": 2, "musicCnt": 19 }, "error": null }
```
- 없는 곡 ID 섞여도 무시하고 실제 삭제 개수만 반환(멱등). POST 사용 이유: DELETE body 누락 문제 회피. 에러: `PLAYLIST_NOT_FOUND`, `FORBIDDEN`.

### 4.6 플레이리스트 이름 변경
`PATCH /playlist/update` · 인증 필요. body: `playlistId`(int, required), `playlistName`(String, required).
```json
{ "success": true, "data": { "playlistId": 42, "playlistName": "새벽 드라이브 v2", "musicCnt": 19 }, "error": null }
```
- 에러: `PLAYLIST_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `PLAYLIST_NAME_DUPLICATED`.

### 4.7 플레이리스트 삭제
`DELETE /playlist/delete/{playlistId}` · 인증 필요. pathVariable: `playlistId`(int, required). res: `{ "success": true, "data": null, "error": null }`.
- 플레이리스트와 곡 매핑 함께 삭제(곡 자체는 미삭제). 에러: `PLAYLIST_NOT_FOUND`, `FORBIDDEN`.
