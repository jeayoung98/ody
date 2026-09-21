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
  /**
   * 폰 하단 탭의 목적지 (S15P21A405-417). **좁은 화면에서만 쓴다** — 데스크톱은 같은 내용을
   * 우측 패널로 열고 이 경로를 밟지 않는다.
   *
   * 지도는 `home` 이다. 탭을 오가도 지도는 안 죽는다 — `app-shell` 이 지도를 들고 있고
   * 이 화면들이 그 위에 덮인다 (라우트마다 지도를 다시 만들면 매번 처음부터 불러온다).
   */
  friends: "/friends",
  chart: "/chart",
  me: "/me",
} as const;

/** 하단 탭이 오가는 경로 모음 — `app-shell` 이 이 목록으로 "앱 화면인가" 를 가른다 */
export const APP_ROUTES: readonly string[] = [ROUTES.home, ROUTES.friends, ROUTES.chart, ROUTES.me];
