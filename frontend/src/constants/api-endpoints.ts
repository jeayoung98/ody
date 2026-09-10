/** 백엔드 API 경로 모음. fetch 호출 시 문자열을 직접 쓰지 않고 여기서 가져온다. */
export const API_ENDPOINTS = {
  health: "/api/health",

  auth: {
    me: "/api/auth/me",
    logout: "/api/auth/logout",
    googleLogin: "/api/auth/google",
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
