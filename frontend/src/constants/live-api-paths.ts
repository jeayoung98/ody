/**
 * `next.config.ts` 의 rewrite 가 배포 백엔드(`BACKEND_ORIGIN`)로 **그대로 흘려보낼** 경로.
 * 여기 없는 `/api/…` 호출은 없다 — 우리 라우트 핸들러는 전부 `/bff/` 에 있다 (`src/app/bff/`).
 *
 * **거의 비어 있다.** 로그인이 목이라 브라우저에 백엔드가 인정하는 토큰이 없어서, 요청을
 * 그대로 흘려보내면 인증이 필요한 API 가 전부 401 이 된다. 그래서 실데이터가 필요한
 * 주변 탐색·경로 탐색은 라우트 핸들러가 서버 토큰(`BACKEND_ACCESS_TOKEN`)을 붙여
 * 대신 호출한다 (`src/lib/backend.ts`).
 *
 * 별자리 배치만 예외로 흘려보낸다 (S15P21A405-278). 지금은 인증이 한시 해제돼 있어서
 * (BACKEND-NOTES A-17) 토큰 없이도 닿는다. **A-17 이 원복되면 여기서 401 이 난다** —
 * 그때는 이 줄을 빼고 `src/app/bff/constellations/layout/route.ts` 를 다시 만들어
 * 서버 토큰을 붙여 대신 부르면 된다. 라우트 하나 + 경로 한 줄이면 되돌아온다.
 *
 * 로그인을 실연동으로 되돌릴 때는 아래 주석을 풀고 `api-endpoints.ts` 의 auth 경로를
 * 실경로(`PATCH /api/user/profile`, `PATCH /api/user/tutorial-completed`)로 바꾸면 된다.
 * 그때는 브라우저가 진짜 accessToken 을 들고 있으므로 흘려보내는 방식이 맞다.
 *
 * 주석 처리된 목록은 2026-09-12 에 `https://j15a405.p.ssafy.io` 로 실호출해 도달을 확인한 것이다.
 * 별자리 배치는 **아직 확인하지 못했다** — 2026-09-13 기준 배포 api-docs 27개 경로에 없다.
 * 백엔드가 배포되면 실호출로 확인한다.
 */
export const LIVE_API_PATHS: readonly string[] = [
  "/api/constellations/layout",
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
