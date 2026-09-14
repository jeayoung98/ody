/**
 * `next.config.ts` 의 rewrite 가 배포 백엔드(`BACKEND_ORIGIN`)로 **그대로 흘려보낼** 경로.
 * 여기 없는 `/api/…` 호출은 없다 — 우리 라우트 핸들러는 전부 `/bff/` 에 있다 (`src/app/bff/`).
 *
 * **거의 비어 있다.** 로그인이 목이라 브라우저에 백엔드가 인정하는 토큰이 없어서, 요청을
 * 그대로 흘려보내면 인증이 필요한 API 가 전부 401 이 된다. 그래서 실데이터가 필요한
 * 주변 탐색·경로 탐색은 라우트 핸들러가 서버 토큰(`BACKEND_ACCESS_TOKEN`)을 붙여
 * 대신 호출한다 (`src/lib/backend.ts`).
 *
 * **지금은 완전히 비어 있다.**
 *
 * 흘려보내기에는 함정이 하나 더 있다 (S15P21A405-303). rewrite 는 브라우저가 보낸 `Origin` 을
 * 그대로 백엔드에 전달하는데, 백엔드는 허용 목록에 없는 오리진을 `403 Invalid CORS request` 로
 * 막는다. 로컬 `http://localhost:3000` 이 정확히 그 경우다:
 *
 * | Origin | 응답 |
 * | --- | --- |
 * | 없음 | 200 |
 * | `https://j15a405.p.ssafy.io` | 200 |
 * | `http://localhost:3000` | 403 |
 *
 * 배포는 페이지 오리진이 백엔드와 같아 통과하므로 **로컬에서만 터진다.** 별자리 배치가 이
 * 목록에 있던 동안 로컬에서 별자리가 아예 안 그려졌다 — 지금은 `/bff/constellations/layout`
 * 라우트 핸들러가 대신 부른다. 여기에 경로를 추가할 때는 로컬에서도 200 인지 먼저 확인한다.
 *
 * 로그인을 실연동으로 되돌릴 때는 아래 주석을 풀고 `api-endpoints.ts` 의 auth 경로를
 * 실경로(`PATCH /api/user/profile`, `PATCH /api/user/tutorial-completed`)로 바꾸면 된다.
 * 그때는 브라우저가 진짜 accessToken 을 들고 있으므로 흘려보내는 방식이 맞다.
 * 다만 위 CORS 문제는 그대로 남으므로, 로컬에서 쓰려면 백엔드 허용 목록에
 * `http://localhost:3000` 이 들어가야 한다.
 *
 * 주석 처리된 목록은 2026-09-12 에 `https://j15a405.p.ssafy.io` 로 실호출해 도달을 확인한 것이다.
 */
export const LIVE_API_PATHS: readonly string[] = [
  // "/api/auth/signup",
  // "/api/auth/login",
  // "/api/auth/login/google",
  // "/api/auth/exchange",
  // "/api/auth/reissue",
  // "/api/auth/logout",
  // "/api/auth/withdraw",
  // "/api/users/nickname-available",
  // "/api/user/tutorial-completed",
  // "/api/user/profile",
  // "/oauth2/authorization/:provider",
  // "/login/oauth2/code/:provider",
];
