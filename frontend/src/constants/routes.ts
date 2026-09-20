/** 페이지 경로 */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  /** 가입 직후 닉네임 설정 (AUTH-01). 닉네임이 없으면 여기로 보낸다 */
  nickname: "/nickname",
  tutorial: "/tutorial",
  /**
   * 검색 전용 화면 (SEARCH-01, S15P21A405-417). **좁은 화면에서만 쓴다** — 지도 위 검색
   * 알약을 누르면 여기로 온다. 데스크톱은 알약이 그 자리에서 펼쳐지므로 이 경로를 안 쓴다.
   */
  search: "/search",
  /** 프로필 수정 — 닉네임·프로필 이미지·공개 설정 (S15P21A405-470) */
  profile: "/profile",
} as const;
