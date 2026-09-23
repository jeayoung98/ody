import type { LayerBox } from "@/types";

/** PC 좌표를 URL 에 실을 때의 자릿수. 화면 한 픽셀보다 훨씬 촘촘하다 */
const round = (v: number) => v.toFixed(4);

/**
 * API 경로 모음. fetch 호출 시 문자열을 직접 쓰지 않고 여기서 가져온다.
 *
 * ## 접두사가 두 가지다 — 헷갈리면 배포가 깨진다
 *
 * | 접두사 | 누가 받나 | 비고 |
 * | --- | --- | --- |
 * | `/bff/…` | **우리 Next 서버**의 라우트 핸들러 (`src/app/bff/`) | 목이거나, 백엔드를 서버에서 대신 부르는 것 |
 * | `/api/…` | **백엔드(Spring)** | `next.config.ts` rewrite(로컬)·nginx(배포)가 그대로 넘긴다 |
 *
 * 배포에서 nginx 가 `/api/` 를 백엔드로 보내기 때문에, **우리 라우트 핸들러를 `/api/` 에 두면
 * 프로덕션에서 아예 닿지 않는다** — 실제로 그래서 모든 데이터 화면이 500 이었다 (S15P21A405-273).
 * 그래서 우리 것은 전부 `/bff/` 다.
 *
 * 인증·마이페이지는 **실연동이다** (S15P21A405-462). 다만 경로는 `/bff/` 로 둔다 —
 * `/api/` 로 직접 부르면 로컬에서 rewrite 가 브라우저의 `Origin` 을 실어 보내 403 이 된다
 * (S15P21A405-303). BFF 라우트가 호출자의 Bearer 토큰과 refresh 쿠키를 그대로 중계한다.
 */
export const API_ENDPOINTS = {
  health: "/bff/health",

  auth: {
    /** 실연동. **본인 조회 API 가 없어서** 토큰의 `sub` 로 `GET /api/user/detail` 을 대신 부른다 (A-15) */
    me: "/bff/auth/me",
    /** 실연동 → `POST /api/auth/logout`. 토큰 무효화 + refresh 쿠키 삭제 */
    logout: "/bff/auth/logout",
    /**
     * 구글 idToken 로그인 (S15P21A405-129) → `POST /api/auth/login/google`.
     * `use-google-login-mutation` 이 `{idToken}` 을 POST 한다.
     * 백엔드의 리다이렉트 진입점 `/oauth2/authorization/google` 은 그 흐름을 쓰지 않으므로 여기 두지 않는다.
     */
    googleLogin: "/bff/auth/google",
    /** 실연동 → `POST /api/auth/signup`. 본문 `{email, password, nickname}` */
    signup: "/bff/auth/signup",
    /** 실연동 → `POST /api/auth/login`. 본문 `{email, password}` */
    login: "/bff/auth/login",
    /** 목. 백엔드 `POST /api/auth/exchange` 가 있다 — OAuth 리다이렉트 흐름을 쓸 때 붙인다 */
    exchange: "/api/auth/exchange",
    /** 실연동 → `PATCH /api/user/tutorial-completed` */
    completeTutorial: "/bff/auth/tutorial/complete",
    /** 실연동 → `POST /api/auth/reissue`. refresh 쿠키로 재발급 (B-8) */
    reissue: "/bff/auth/reissue",
  },

  user: {
    /**
     * 실연동 → `GET /api/user/detail?email=`. 응답에 `followerCnt`·`followingCnt`·`isFollowing`·`isMe`
     * 가 더 오고 `updatedAt` 은 없다. **지금 듣는 곡·만남 횟수·대시보드 통계는 백엔드에 아예 없다** (A-35).
     */
    detail: (email: string) => `/bff/users/${encodeURIComponent(email)}`,
    /** 실연동 → `GET /api/users/nickname-available` */
    nicknameAvailable: (nickname: string) => `/bff/users/nickname-available?nickname=${encodeURIComponent(nickname)}`,
    /**
     * 실연동 → `PATCH /api/user/nickname`. 가입 직후 닉네임 화면과 프로필 수정 화면이 같이 쓴다.
     *
     * 예전에는 이미지와 함께 `PATCH /api/user/profile` 하나로 보냈는데(A-13), 백엔드가 둘을
     * 갈라 놓으면서 그 경로가 없어졌다 (S15P21A405-426 · 474).
     */
    nickname: "/bff/user/nickname",
    /** 실연동 → `PATCH /api/user/image`. **파일**을 올린다 — 주소 문자열은 받지 않는다 */
    image: "/bff/user/image",
    /**
     * 실연동 → `PATCH /api/user/public`. **설정이 아니라 전원을 공개로 못박는 자리다**
     * (S15P21A405-574). 공개/비공개 계정은 폐지됐는데 배포 백엔드가 아직 그 값으로 막는다.
     * 백엔드가 `USER_PRIVATE` 를 걷어내면(BACKEND-NOTES A-59) 이 항목도 같이 지운다.
     */
    publicVisibility: "/bff/user/public",
    /**
     * 팔로우 = **구독**이다 (S15P21A405-489, BACKEND-NOTES A-37~A-39). 인스타그램식으로
     * 상대를 구독해 두는 것이고, 지도에서 그 사람을 **따라다니는 탑승(ride)과 다르다.**
     * 탑승은 `POST /api/realtime/ride` 로 따로 있다 (S15P21A405-530, 실연동).
     *
     * 거는 쪽은 토큰 주체라 본문에 없다. 경로가 사용자별이 아니라 고정인 것도 그래서다.
     */
    followInsert: "/bff/users/follow/insert",
    followDelete: "/bff/users/follow/delete",
    /** `type` 은 `follower`(나를 구독한 사람) / `following`(내가 구독한 사람), `page` 는 0부터 */
    followList: (email: string, type: "follower" | "following", page = 0) =>
      `/bff/users/follow/list?email=${encodeURIComponent(email)}&type=${type}&page=${page}`,
    reaction: (email: string) => `/bff/users/${encodeURIComponent(email)}/reactions`,
  },

  map: {
    /**
     * 이 겹의 상주 집합. `boxes` = 이전 겹들에서 뷰포트로 좁힌 누적 범위 (레이어 0 이면 빈 배열).
     * 서버 쪽 level·축 번호는 1-based 다 — 레이어 l 은 level l+1, 평면은 pc(2l+1)·pc(2l+2).
     * 누적 범위를 level-1 쌍 전부 실어야 candidate(N+1) ⊆ candidate(N) 이 성립한다 (백엔드 MajorQuery).
     * 실서비스 경로는 백엔드 `/api/music/major` 로 합쳐진다 (BACKEND-NOTES A-1).
     */
    songs: (boxes: readonly LayerBox[]) => {
      const q = [`level=${boxes.length + 1}`];
      for (const b of boxes) {
        const k = b.layer * 2 + 1;
        q.push(`pc${k}min=${round(b.xMin)}`, `pc${k}max=${round(b.xMax)}`, `pc${k + 1}min=${round(b.yMin)}`, `pc${k + 1}max=${round(b.yMax)}`);
      }
      return `/bff/map/songs?${q.join("&")}`;
    },
    // nearby 는 라우트 핸들러가 백엔드 `GET /api/music/detail?id=` 의 neighbors 로 만들어 준다
    nearby: (musicId: number) => `/bff/map/nearby/${musicId}`,
  },

  music: {
    detail: (id: number) => `/bff/music/${id}`,
    search: "/bff/music/search",
    /**
     * 재생 선언 (S15P21A405-482). **곡 ID 를 본문으로 보낸다** — 경로에 안 넣는다.
     * 이 호출이 곧 내 위치 이동이다.
     */
    play: "/bff/music/play",
    /** 재생 종료. 위치는 바뀌지 않고 들은 시간만 남긴다 */
    /** 곡 하나의 videoId. 상세 응답이 아니라 **전용 엔드포인트**가 출처다 (S15P21A405-340) */
    videoId: (id: number) => `/bff/music/${id}/video-id`,
    /**
     * 곡 신고 (S15P21A405-377). **실연동이다** (BACKEND-NOTES A-28).
     * 경로는 프론트 것으로 둔다 — 백엔드는 곡을 본문으로 받고, 그 번역은 BFF 라우트가 한다.
     */
    report: (id: number) => `/bff/music/${id}/report`,
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
    list: "/bff/playlists",
    /**
     * 만든 플리 · 좋아요한 플리. **이메일을 주면 그 사람 것**이다 (S15P21A405-587).
     *
     * 백엔드 `GET /api/playlist/search` · `/liked` 는 처음부터 `email` 로 **아무나** 조회하는
     * API 다 ("본인 목록도 이 API(email에 본인 email)" — 컨트롤러 주석). 공개 범위 판정도
     * 서비스 안에 있다. 우리 쪽만 토큰 주체로 박아 두고 있어서 남의 피드에 못 붙였다.
     *
     * 경로 이름은 `mine` 그대로 둔다 — 부르는 쪽 대부분이 실제로 내 것을 원하고(플리 추가 메뉴 ·
     * 플리 패널), 이름을 바꾸면 그 자리들까지 건드리게 된다. 안 주면 예전과 똑같이 토큰 주체다.
     */
    mine: (email?: string | null) => (email ? `/bff/playlists/mine?email=${encodeURIComponent(email)}` : "/bff/playlists/mine"),
    liked: (email?: string | null) => (email ? `/bff/playlists/liked?email=${encodeURIComponent(email)}` : "/bff/playlists/liked"),
    detail: (id: number) => `/bff/playlists/${id}`,
    items: (id: number) => `/bff/playlists/${id}/items`,
    item: (id: number, musicId: number) => `/bff/playlists/${id}/items/${musicId}`,
    /**
     * 곡 순서 바꾸기 (S15P21A405-540) → 백엔드 `POST /api/playlist/music/reorder`.
     * 본문은 **새 순서의 전체 목록**(`{musicIds}`)이다 — 바뀐 곡만 보내는 길이 없다.
     */
    order: (id: number) => `/bff/playlists/${id}/order`,
    like: (id: number) => `/bff/playlists/${id}/like`,
  },

  /**
   * 실시간 (S15P21A405-482).
   *
   * **`/bff/` 를 거친다 — 명세와 다른 선택이다.** 명세 §0 은 "브라우저가 직접 부른다,
   * `/bff/` 라우트를 만들지 않는다" 고 적었고 이유는 "서버가 대신 부르면 전원이 한 사람으로
   * 취급된다" 였다. 그 이유가 S15P21A405-481 로 사라졌다 — BFF 가 **호출자의 Authorization 을
   * 그대로 넘기므로** 백엔드는 각 사용자를 그대로 본다.
   *
   * 대신 직접 호출에는 막는 함정이 있다 (`live-api-paths.ts`, S15P21A405-303): rewrite 는
   * 브라우저의 `Origin` 을 그대로 넘기는데 백엔드가 `http://localhost:3000` 을
   * `403 Invalid CORS request` 로 막는다. 직접 호출로 두면 **로컬에서만 전부 터진다.**
   *
   * 되돌리기는 쉽다 — 경로를 `/api/...` 로 바꾸고 `live-api-paths.ts` 에 세 줄을 넣으면 된다.
   * 백엔드 CORS 허용 목록에 로컬 오리진이 들어가면 그때 옮긴다.
   */
  realtime: {
    /** 주변 사람 목록 열기. 본문 없음. 이 호출이 곧 실시간 구독 시작이다 */
    nearby: "/bff/realtime/nearby",
    /**
     * 탑승(POST, 본문 `{captainEmail}`)과 하차(DELETE, 본문 없음)가 **같은 경로**다
     * (S15P21A405-530) — 백엔드 `POST·DELETE /api/realtime/ride`.
     *
     * **소켓이 아니라 REST 인 이유**가 계약에 적혀 있다: 소켓으로 보내면 거부당했을 때 아무
     * 응답도 오지 않아 버튼만 안 먹는 것처럼 보인다. 거부 사유(`RIDE_FULL` · `RIDE_SELF` …)가
     * 사용자에게 보여야 하는 경로다.
     */
    ride: "/bff/realtime/ride",
    /**
     * 그 겹에서 **재생 중인 사람 전부** (S15P21A405-537, BACKEND-NOTES §5).
     *
     * **화면 범위와 무관하다.** 소켓 `VIEWPORT_SNAPSHOT` 은 보이는 범위만 주고 칸이 많아지면
     * "N명" 뭉치로 바꿔 버리는데, 지도는 줌과 상관없이 사람을 **전부 한 명씩** 그리기로 했다
     * (팀 결정). 그 결정을 만족시키는 유일한 출처다.
     *
     * `layer` 는 **0-based** 로 그대로 넘긴다 — 곡 조회(`map.songs`)의 `level` 처럼 +1 하지 않는다.
     * 범위(0~7) 밖이면 400 이다. 밀어 주는 이벤트가 없어서 **레이어를 옮길 때와 주기적으로** 다시 부른다.
     */
    layerUsers: (layer: number) => `/bff/realtime/layers/${layer}/users`,
  },

  constellation: {
    /**
     * 좌표 원천은 여전히 **백엔드 한 곳**이다 (서빙 baseline) — 라우트 핸들러가 계산하지 않고
     * `/api/constellations/layout` 을 대신 부르기만 한다 (S15P21A405-278).
     *
     * rewrite 로 흘려보내다가 `/bff/` 로 되돌렸다 (S15P21A405-303). rewrite 는 브라우저의
     * `Origin` 을 그대로 백엔드에 넘기는데, 허용 목록에 없는 오리진은 403 으로 막힌다 —
     * 로컬에서 별자리가 아예 안 그려졌다.
     */
    layout: "/bff/constellations/layout",
  },

  journey: {
    /**
     * 라우트 핸들러가 받는다. `BACKEND_ACCESS_TOKEN` 이 있으면 그 안에서 배포 백엔드의
     * `GET /api/music/journey` 를 서비스 토큰으로 대신 부르고, 없으면 목 경로를 준다.
     */
    route: "/bff/journeys/route",
  },

  chart: {
    ranking: (type: string) => `/bff/charts/${type}`,
  },
} as const;
