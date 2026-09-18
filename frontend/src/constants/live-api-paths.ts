/**
 * `next.config.ts` 의 rewrite 가 배포 백엔드(`BACKEND_ORIGIN`)로 **그대로 흘려보낼** 경로.
 * 여기 없는 `/api/…` 호출은 없다 — 우리 라우트 핸들러는 전부 `/bff/` 에 있다 (`src/app/bff/`).
 *
 * **지금은 완전히 비어 있다.** 인증이 실연동이 된 뒤에도(S15P21A405-462) 비어 있는데, 이유가
 * 바뀌었다. 예전에는 "브라우저에 진짜 토큰이 없어서" 였고, 지금은 **흘려보내면 로컬이 깨져서**다 —
 * 아래 `Origin` 함정 때문이다. 그래서 인증 경로도 `/bff/auth/*` 라우트 핸들러가 중계한다
 * (호출자의 Bearer 토큰과 refresh 쿠키를 그대로 넘긴다, `lib/backend.ts` 의 `backendProxy`).
 * 지도·주변 탐색처럼 로그인 없이도 보여야 하는 것만 서버 토큰(`BACKEND_ACCESS_TOKEN`)을 쓴다.
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
 * 여기로 옮기려면 백엔드 CORS 허용 목록에 `http://localhost:3000` 이 먼저 들어가야 한다.
 * 그 전까지는 BFF 중계가 로컬·배포 양쪽에서 똑같이 도는 유일한 길이다.
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
  // "/api/user/nickname",
  // "/api/user/image",
  // "/oauth2/authorization/:provider",
  // "/login/oauth2/code/:provider",
];
