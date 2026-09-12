/** 백엔드 API 경로 모음. fetch 호출 시 문자열을 직접 쓰지 않고 여기서 가져온다. */
export const API_ENDPOINTS = {
  health: "/api/health",

  auth: {
    /** 본인 조회. 백엔드에 아직 없다 — 지금은 목 라우트만 응답한다 (BACKEND-NOTES A-15) */
    me: "/api/auth/me",
    logout: "/api/auth/logout",
    /** 구글 로그인 진입. Spring Security 기본 경로라 /api 아래가 아니다 (backend/dev SecurityConfig) */
    googleLogin: "/oauth2/authorization/google",
    /** 이메일·비밀번호 가입 — 요청 본문에 email, password, nickname (backend/dev, S15P21A405-121) */
    signup: "/api/auth/signup",
    /** 이메일·비밀번호 로그인 — 요청 본문에 email, password */
    login: "/api/auth/login",
    /** 구글 신규 사용자의 닉네임 확정. 백엔드에 아직 없다 (BACKEND-NOTES A-13) */
    nickname: "/api/auth/nickname",
    /** OAuth 콜백 code → accessToken 교환. refresh token 은 httpOnly 쿠키로 이미 심겨 있다 */
    exchange: "/api/auth/exchange",
    completeTutorial: "/api/auth/tutorial/complete",
  },

  map: {
    songs: "/api/map/songs",
    representatives: (layer: number) => `/api/map/layers/${layer}/representatives`,
    representativeLayers: (musicId: number) => `/api/music/${musicId}/representative-layers`,
    nearby: (musicId: number) => `/api/map/nearby/${musicId}`,
  },

  music: {
    detail: (id: number) => `/api/music/${id}`,
    search: "/api/music/search",
    play: (id: number) => `/api/music/${id}/play`,
  },

  user: {
    profile: (email: string) => `/api/users/${encodeURIComponent(email)}`,
    /** 닉네임 중복 확인 (A-12) */
    nicknameAvailable: (nickname: string) => `/api/users/nickname-available?nickname=${encodeURIComponent(nickname)}`,
    nearby: (layer: number) => `/api/users/nearby?layer=${layer}`,
    follow: (email: string) => `/api/users/${encodeURIComponent(email)}/follow`,
    reaction: (email: string) => `/api/users/${encodeURIComponent(email)}/reactions`,
  },

  playlist: {
    list: "/api/playlists",
    mine: "/api/playlists/mine",
    liked: "/api/playlists/liked",
    detail: (id: number) => `/api/playlists/${id}`,
    items: (id: number) => `/api/playlists/${id}/items`,
    item: (id: number, musicId: number) => `/api/playlists/${id}/items/${musicId}`,
    like: (id: number) => `/api/playlists/${id}/like`,
  },

  constellation: {
    layout: "/api/constellations/layout",
  },

  journey: {
    route: "/api/journeys/route",
  },

  chart: {
    ranking: (type: string) => `/api/charts/${type}`,
  },
} as const;
