import type { LayerBox } from "@/types";

/** PC 좌표를 URL 에 실을 때의 자릿수. 화면 한 픽셀보다 훨씬 촘촘하다 */
const round = (v: number) => v.toFixed(4);

/**
 * 백엔드 API 경로 모음. fetch 호출 시 문자열을 직접 쓰지 않고 여기서 가져온다.
 *
 * **[실]** 표시는 배포된 백엔드가 실제로 응답하는 경로다 (`live-api-paths.ts` 목록과 같아야 한다).
 * 표시가 없으면 아직 `src/app/api/` 목 라우트가 답하는 것이고, 대응 항목이 BACKEND-NOTES 에 있다.
 */
export const API_ENDPOINTS = {
  health: "/api/health",

  auth: {
    /** 본인 조회. 백엔드에 아직 없다 — 지금은 목 라우트만 응답한다 (BACKEND-NOTES A-15) */
    me: "/api/auth/me",
    /** [실] 인증 필요. 토큰 블랙리스트 등록 + refresh 쿠키 삭제 */
    logout: "/api/auth/logout",
    /** [실] 구글 로그인 진입. Spring Security 기본 경로라 /api 아래가 아니다 */
    googleLogin: "/oauth2/authorization/google",
    /** [실] 이메일·비밀번호 가입 — 본문 `{email, password, nickname}` → `{accessToken}` */
    signup: "/api/auth/signup",
    /** [실] 이메일·비밀번호 로그인 — 본문 `{email, password}` → `{accessToken}` */
    login: "/api/auth/login",
    /** [실] 구글 idToken 로그인 — 본문 `{idToken}` → `{accessToken, user}` */
    loginGoogle: "/api/auth/login/google",
    /** [실] OAuth 콜백 code → accessToken 교환. refresh 는 httpOnly 쿠키로 이미 심겨 있다 */
    exchange: "/api/auth/exchange",
    /** [실] refresh 쿠키로 accessToken 재발급 (BACKEND-NOTES B-8) */
    reissue: "/api/auth/reissue",
    /** [실] 회원 탈퇴 (BACKEND-NOTES B-9) */
    withdraw: "/api/auth/withdraw",
  },

  user: {
    /** [실] PATCH, 본문 `{nickname?, imageUrl?}` → `{nickname, imageUrl}`. 토큰 주체 본인 대상 */
    profile: "/api/user/profile",
    /** [실] PATCH, 본문 없음 → `{tutorialCompleted}` */
    completeTutorial: "/api/user/tutorial-completed",
    /** [실] 닉네임 중복 확인 → `{available}` */
    nicknameAvailable: (nickname: string) => `/api/users/nickname-available?nickname=${encodeURIComponent(nickname)}`,
    /** 남의 프로필 조회. 백엔드 `GET /user/detail?email=` 은 nginx 가 프록시하지 않아 못 부른다 (B-16) */
    detail: (email: string) => `/api/users/${encodeURIComponent(email)}`,
    nearby: (layer: number) => `/api/users/nearby?layer=${layer}`,
    follow: (email: string) => `/api/users/${encodeURIComponent(email)}/follow`,
    reaction: (email: string) => `/api/users/${encodeURIComponent(email)}/reactions`,
  },

  map: {
    /**
     * 이 겹의 상주 집합. `boxes` = 이전 겹들에서 뷰포트로 좁힌 누적 범위 (레이어 0 이면 빈 배열).
     * 서버 쪽 level·축 번호는 1-based 다 — 레이어 l 은 level l+1, 평면은 pc(2l+1)·pc(2l+2).
     * 누적 범위를 level-1 쌍 전부 실어야 candidate(N+1) ⊆ candidate(N) 이 성립한다 (백엔드 MajorQuery).
     * 실서비스 경로는 `/api/music/major` 로 합쳐진다 (BACKEND-NOTES A-1).
     */
    songs: (boxes: readonly LayerBox[]) => {
      const q = [`level=${boxes.length + 1}`];
      for (const b of boxes) {
        const k = b.layer * 2 + 1;
        q.push(`pc${k}min=${round(b.xMin)}`, `pc${k}max=${round(b.xMax)}`, `pc${k + 1}min=${round(b.yMin)}`, `pc${k + 1}max=${round(b.yMax)}`);
      }
      return `/api/map/songs?${q.join("&")}`;
    },
    representatives: (layer: number) => `/api/map/layers/${layer}/representatives`,
    representativeLayers: (musicId: number) => `/api/music/${musicId}/representative-layers`,
    nearby: (musicId: number) => `/api/map/nearby/${musicId}`,
  },

  music: {
    detail: (id: number) => `/api/music/${id}`,
    search: "/api/music/search",
    play: (id: number) => `/api/music/${id}/play`,
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
    /** [실] `?start=&end=` → `{musicCnt, totalDuration, path[]}`. 인증 필요 */
    route: "/api/music/journey",
  },

  chart: {
    ranking: (type: string) => `/api/charts/${type}`,
  },
} as const;
