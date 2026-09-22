/**
 * TanStack Query 키 모음.
 * 모든 useQuery / invalidateQueries 는 반드시 여기 정의된 키를 사용한다.
 * 계층 구조: [도메인, 세부, 파라미터] — 상위 키로 invalidate 하면 하위가 함께 무효화된다.
 */
import type { LayerBox, SearchCondition } from "@/types";

export const QUERY_KEYS = {
  health: ["health"] as const,

  auth: {
    me: ["auth", "me"] as const,
    /** 닉네임 중복 확인 */
    nicknameAvailable: (nickname: string) => ["auth", "nickname-available", nickname] as const,
  },

  /** 별자리 배치 (곡 집합이 같으면 같은 모양) */
  constellation: {
    layout: (musicIds: number[]) => ["constellation", "layout", musicIds.join(",")] as const,
  },

  map: {
    /**
     * 이 겹의 상주 집합. 키가 누적 범위까지 포함해서, 떠올랐다 다시 내려가는 길은 캐시에 남는다.
     * 범위를 새로 좁혀 내려가면 다른 키가 되어 새로 받는다.
     */
    songs: (boxes: readonly LayerBox[]) =>
      ["map", "songs", boxes.map((b) => `${b.layer}:${[b.xMin, b.yMin, b.xMax, b.yMax].map((v) => v.toFixed(4)).join(",")}`).join("|")] as const,
    /** 이 곡이 대표곡으로 노출되는 레이어 목록 */
    /** 특정 곡 기준 가까운 곡 */
    nearby: (musicId: number) => ["map", "nearby", musicId] as const,
  },

  music: {
    all: ["music"] as const,
    detail: (id: number) => ["music", "detail", id] as const,
    /**
     * 검색 (S15P21A405-399). **모드까지 키에 넣는다** — 같은 문자열이라도 통합 검색과 아티스트
     * 검색은 다른 질문이라, 조건을 바꿨을 때 이전 모드의 결과가 그대로 보이면 안 된다.
     */
    search: (c: SearchCondition) =>
      (c.mode === "all"
        ? (["music", "search", "all", c.query] as const)
        : c.mode === "artist"
          ? (["music", "search", "artist", c.artist, c.music] as const)
          : (["music", "search", "music", c.music, c.artist] as const)),
    videoId: (id: number) => ["music", "video-id", id] as const,
  },

  user: {
    /** 프로필을 고치면 내 것이든 남이 보는 것이든 전부 다시 읽어야 한다 */
    all: ["user"] as const,
    profile: (email: string) => ["user", "profile", email] as const,
    /** 팔로워·팔로잉 목록 (S15P21A405-489). 보는 사람 기준 값이 섞여 있어 email·type·page 가 다 키다 */
    followList: (email: string, type: "follower" | "following", page: number) => ["user", "follow-list", email, type, page] as const,
  },

  playlist: {
    all: ["playlist"] as const,
    detail: (id: number) => ["playlist", "detail", id] as const,
    mine: ["playlist", "mine"] as const,
    liked: ["playlist", "liked"] as const,
  },

  journey: {
    route: (startId: number, endId: number) => ["journey", "route", startId, endId] as const,
  },

  chart: {
    ranking: (type: string) => ["chart", type] as const,
  },
  /**
   * 실시간 (S15P21A405-482). `user.nearby(layer)` 와 **다른 축이다** — 저건 화면 범위 기준
   * 폴링이었고, 이건 내가 듣는 곡 기준이라 레이어를 타지 않는다. 그래서 키에 인자가 없다.
   */
  realtime: {
    nearby: ["realtime", "nearby"] as const,
    /** 겹이 바뀌면 다른 목록이다 — 키에 겹을 넣어야 옮길 때 이전 겹 사람이 잠깐 남지 않는다 */
    layerUsers: (layer: number) => ["realtime", "layerUsers", layer] as const,
  },

} as const;
