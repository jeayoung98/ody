import type { LayerBox } from "@/types";

/** PC 좌표를 URL 에 실을 때의 자릿수. 화면 한 픽셀보다 훨씬 촘촘하다 */
const round = (v: number) => v.toFixed(4);

/**
 * 백엔드 API 경로 모음. fetch 호출 시 문자열을 직접 쓰지 않고 여기서 가져온다.
 *
 * **[실]** 표시는 배포된 백엔드가 실제로 응답하는 경로다 (`live-api-paths.ts` 목록과 같아야 한다).
 * 표시가 없으면 `src/app/api/` 목 라우트가 답하는 것이고, 대응 항목이 BACKEND-NOTES 에 있다.
 *
 * 로그인·온보딩은 **의도적으로 목이다.** 유저 테스트가 주변 탐색·경로 탐색만 보기 때문에
 * 실계정 가입 절차를 태우지 않는다. 백엔드에는 `/api/auth/*` 가 전부 있으므로
 * 나중에 `live-api-paths.ts` 에 다시 넣기만 하면 실연동으로 돌아온다.
 */
export const API_ENDPOINTS = {
  health: "/api/health",

  auth: {
    /** 목. 본인 조회는 백엔드에 아직 없다 (BACKEND-NOTES A-15) */
    me: "/api/auth/me",
    /** 목. 백엔드 `POST /api/auth/logout` 이 있다 */
    logout: "/api/auth/logout",
    /**
     * 구글 idToken 로그인 (S15P21A405-129). `use-google-login-mutation` 이 `{idToken}` 을 POST 한다.
     * 목이 없는 유일한 인증 경로라 실제로 쓰려면 `live-api-paths.ts` 에 이 경로를 넣어야 한다.
     * 백엔드의 리다이렉트 진입점 `/oauth2/authorization/google` 은 그 흐름을 쓰지 않으므로 여기 두지 않는다.
     */
    googleLogin: "/api/auth/login/google",
    /** 목. 백엔드 `POST /api/auth/signup` 이 있다 — 본문 `{email, password, nickname}` */
    signup: "/api/auth/signup",
    /** 목. 백엔드 `POST /api/auth/login` 이 있다 — 본문 `{email, password}` */
    login: "/api/auth/login",
    /** 목. 백엔드에서는 `PATCH /api/user/profile` 이 이 역할을 한다 (A-13) */
    nickname: "/api/auth/nickname",
    /** 목. 백엔드 `POST /api/auth/exchange` 가 있다 */
    exchange: "/api/auth/exchange",
    /** 목. 백엔드 `PATCH /api/user/tutorial-completed` 가 이 역할을 한다 */
    completeTutorial: "/api/auth/tutorial/complete",
    /** 백엔드 전용 — refresh 쿠키로 재발급. 실연동으로 돌아갈 때 쓴다 (B-8) */
    reissue: "/api/auth/reissue",
  },

  user: {
    /**
     * 목. 백엔드는 `GET /api/user/detail?email=` 이고 **도달은 된다** (B-16 해소).
     * 응답에 `followerCnt`·`followingCnt`·`isFollowing`·`isMe` 가 더 오고 `updatedAt` 은 없다 (0-2 필드 대조).
     */
    detail: (email: string) => `/api/users/${encodeURIComponent(email)}`,
    /** 목. 백엔드 `GET /api/users/nickname-available` 이 있다 */
    nicknameAvailable: (nickname: string) => `/api/users/nickname-available?nickname=${encodeURIComponent(nickname)}`,
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
    // nearby 는 라우트 핸들러가 백엔드 `GET /api/music/detail?id=` 의 neighbors 로 만들어 준다
    representatives: (layer: number) => `/api/map/layers/${layer}/representatives`,
    nearby: (musicId: number) => `/api/map/nearby/${musicId}`,
  },

  music: {
    detail: (id: number) => `/api/music/${id}`,
    search: "/api/music/search",
    play: (id: number) => `/api/music/${id}/play`,
  },

  /**
   * **전부 목이다.** 백엔드에 8종이 다 있지만 **경로도 응답 모양도 다르다** (BACKEND-NOTES 0-2):
   * `POST /api/playlist/create` · `PATCH /api/playlist/update` · `DELETE /api/playlist/delete/{id}` ·
   * `GET /api/playlist/detail?playlistId=` · `GET /api/playlist/search?email=` ·
   * `POST /api/playlist/music/{insert,delete,reorder}` (곡은 **배열** `musicIdList` 로 주고받는다).
   *
   * 그대로 붙이면 화면이 깨진다 — 백엔드 응답에 **좋아요·무드 태그·소유자·`addedAt` 이 없다.**
   * FEATURES 의 PATH-06·유저플로우 13·14 항목이라 프론트가 임의로 뺄 수 없다. 팀 결정 대기.
   */
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
    /**
     * 라우트 핸들러가 받는다. `BACKEND_ACCESS_TOKEN` 이 있으면 그 안에서 배포 백엔드의
     * `GET /api/music/journey` 를 서비스 토큰으로 대신 부르고, 없으면 목 경로를 준다.
     */
    route: "/api/journeys/route",
  },

  chart: {
    ranking: (type: string) => `/api/charts/${type}`,
  },
} as const;
