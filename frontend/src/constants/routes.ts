/** 페이지 경로 */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  /** 가입 직후 닉네임 설정 (AUTH-01). 닉네임이 없으면 여기로 보낸다 */
  nickname: "/nickname",
  tutorial: "/tutorial",
  /** 프로필 수정 — 닉네임·프로필 이미지·공개 설정 (S15P21A405-470) */
  profile: "/profile",
} as const;
