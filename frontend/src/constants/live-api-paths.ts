/**
 * 배포된 백엔드가 **실제로 구현했고 nginx 가 백엔드로 넘겨주는** 경로만 모았다.
 *
 * 여기 적힌 경로는 `next.config.ts` 의 rewrite 가 실서버(`BACKEND_ORIGIN`)로 프록시하고,
 * 나머지는 그대로 `src/app/api/` 목 라우트가 받는다. 그래서 실연동과 목이 한 앱에서 공존한다.
 *
 * 와일드카드를 쓰지 않고 한 줄씩 적는 이유: 백엔드에 없는 경로(`/api/auth/me` 등)까지
 * 프록시로 넘어가면 목 라우트가 가려져 404 가 된다. **확인된 것만 넣는다.**
 *
 * 확인 방법·시점: 2026-09-12, `https://j15a405.p.ssafy.io` 실호출 + 배포 브랜치
 * (`origin/backend/jenkins`) 컨트롤러 대조. 배포본이 바뀌면 이 목록을 다시 확인한다.
 */
export const LIVE_API_PATHS = [
  // AuthController — /api/auth (가입·로그인·교환·재발급은 permitAll)
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/login/google",
  "/api/auth/exchange",
  "/api/auth/reissue",
  "/api/auth/logout",
  "/api/auth/withdraw",

  // UserAvailabilityController — permitAll
  "/api/users/nickname-available",

  // UserOnboardingController / UserProfileController — 둘 다 PATCH, 토큰 주체 본인 대상
  "/api/user/tutorial-completed",
  "/api/user/profile",

  // JourneyController — MusicController 와 달리 이미 /api 아래에 있다
  "/api/music/journey",

  // Spring Security 기본 OAuth 경로. /api 아래가 아니지만 nginx 가 프록시한다
  "/oauth2/authorization/:provider",
  "/login/oauth2/code/:provider",
] as const;
