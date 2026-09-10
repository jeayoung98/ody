/**
 * TanStack Query 키 모음.
 * 모든 useQuery / invalidateQueries 는 반드시 여기 정의된 키를 사용한다.
 * 계층 구조: [도메인, 세부, 파라미터] — 상위 키로 invalidate 하면 하위가 함께 무효화된다.
 */
export const QUERY_KEYS = {
  health: ["health"] as const,

  auth: {
    me: ["auth", "me"] as const,
  },

  /** 별자리 배치 (곡 집합이 같으면 같은 모양) */
  constellation: {
    layout: (musicIds: number[]) => ["constellation", "layout", musicIds.join(",")] as const,
  },

  map: {
    /** 지도 곡 전체 (PC 벡터 포함) */
    songs: ["map", "songs"] as const,
    /** 레이어별 대표곡 ID */
    representatives: (layer: number) => ["map", "representatives", layer] as const,
    /** 이 곡이 대표곡으로 노출되는 레이어 목록 */
    representativeLayers: (musicId: number) => ["map", "representative-layers", musicId] as const,
    /** 특정 곡 기준 가까운 곡 */
    nearby: (musicId: number) => ["map", "nearby", musicId] as const,
  },

  music: {
    all: ["music"] as const,
    detail: (id: number) => ["music", "detail", id] as const,
    search: (keyword: string) => ["music", "search", keyword] as const,
  },

  user: {
    profile: (email: string) => ["user", "profile", email] as const,
    nearby: (layer: number) => ["user", "nearby", layer] as const,
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
} as const;
