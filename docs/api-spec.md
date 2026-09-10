# ODY API 명세서 v1.0

> 출처: Notion 「ODY api 명세서 최종」(정본). 정본은 Notion이며, 이 문서는 스냅샷이다.
> 상위 「API 명세서(수정중)」의 개별 API 페이지와 차이가 있으면 **이 정본이 우선**한다.

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
  "isNewUser": true,
  "user": { "email": "user@gmail.com", "name": "홍길동", "nickname": null, "imageUrl": "https://lh3..." }
}, "error": null }
```
- 정본과 실제 구현의 차이: `refreshToken`은 body가 아니라 httpOnly 쿠키로 내려간다(exchange/reissue와 동일 컨벤션, 탈취 위험 감소). `accessTokenExpiresIn`은 아직 응답에 없다.
- idToken 검증은 Google 공식 라이브러리(`GoogleIdTokenVerifier`)로 서명·발급자·audience(`GOOGLE_CLIENT_ID`)·만료를 확인한다. `email_verified=false`인 idToken도 거부한다.
- **`isNewUser`는 신규 컬럼이 아니라 `!tutorial_completed`다**(§1.5 참고) — 신규 가입이거나 아직 온보딩(지도 튜토리얼)을 안 끝냈으면 true. `isNewUser: true`면 온보딩 화면으로 이동. 에러: `OAUTH_FAILED`(idToken 위조·만료·audience 불일치·email 미인증).
- 대안(서버 리다이렉트, Spring Security OAuth2 Client, 기존 그대로 유지): `GET /oauth2/authorization/google` → 동의 화면, `GET /login/oauth2/code/google` → 콜백, 성공 시 `{FRONTEND_OAUTH_REDIRECT_URI}?code=...`로 302, 프론트가 `POST /api/auth/exchange`로 code를 accessToken과 교환(§1.4 참고 경로들과 동일 컨벤션). 이 경로는 isNewUser를 아직 응답에 실어 보내지 않는다(미해결 갭).

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
- 경로가 `/api/users`(복수, api 접두사)로, 이 저장소의 다른 컨트롤러(`/user/detail`, `/music/detail`)나
  `/api/auth/*`와도 다른 세 번째 네이밍이다. 사용자가 지정한 경로를 그대로 따랐다.

### 1.5 온보딩 완료 처리 (S15P21A405-122)
`PATCH /api/user/tutorial-completed` · 인증 필요. 토큰 주체 본인만 대상이라 email을 받지 않는다(§0.7 본인 대상 API 규칙).
```json
{ "success": true, "data": { "tutorialCompleted": true }, "error": null }
```
- `"user".tutorial_completed`를 true로 전환한다. 이후 §1.1/§1.4 로그인 응답의 `isNewUser`는 이 사용자에 대해
  항상 false. 이미 true여도 멱등하게 200.
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

### 2.2 사용자 수정 (온보딩)
`PATCH /user/update` · 인증 필요 · `multipart/form-data`. body: `nickname`(String, opt), `image`(file, opt). res: 2.1과 동일 상세 객체.
- 대상은 토큰 주체(`email` 안 받음). 미전달 필드는 기존 값 유지(PATCH). 에러: `USER_NOT_FOUND`, `VALIDATION_ERROR`, `UNSUPPORTED_FILE_TYPE`, `FILE_TOO_LARGE`.

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

### 3.1 노래 검색
`GET /music/search` · 인증 필요. param: `query`(String, required), `page`(int, required, 0).
```json
{ "success": true, "data": { "content": [ {
  "id": 10234, "title": "Love wins all", "artist": "IU", "album": "The Winning",
  "genres": ["K-Pop"], "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
  "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 }
} ], "page": 0, "size": 20, "totalElements": 137, "totalPages": 7, "hasNext": true }, "error": null }
```
- 결과 없음은 빈 content+200. 에러: `VALIDATION_ERROR`.

### 3.2 노래 상세 조회
`GET /music/detail` · 인증 필요. param: `id`(int, required).
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
`GET /music/journey` · 인증 필요. param: `start`(int, required, 시작곡 ID), `end`(int, required, 끝곡 ID).
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
`GET /music/major` · 인증 필요. 지도 확대 단계(`level`)와 구역 중심 좌표(`pc1`~`pc16`)로 구역 대표곡 반환. level에 따라 사용하는 PC 축 개수가 달라짐.

param: `level`(int, required, 기본 1), `pc1`~`pc16`(float, not required).
```json
{ "success": true, "data": { "content": [ {
  "id": 10234, "mbid": "b1a9c0e9-...", "title": "Love wins all", "artist": "IU", "bpm": 128.4, "duration": 275,
  "album": "The Winning", "genres": ["K-Pop"], "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
  "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 }, "playCnt": 1428, "youtubeCnt": 3
} ] }, "error": null }
```
- `level = 1`(최상위)에서는 PC 값 없이 호출 가능. 에러: `VALIDATION_ERROR`.

---

## 4. 플레이리스트

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
