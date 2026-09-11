/** 페이지 경로 */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  /** 가입 직후 닉네임 설정 (AUTH-01). 닉네임이 없으면 여기로 보낸다 */
  nickname: "/nickname",
  tutorial: "/tutorial",
  /** 구글 OAuth 콜백 착지점. 백엔드가 ?code= 를 붙여 여기로 보낸다 */
  oauthRedirect: "/oauth/redirect",
} as const;
