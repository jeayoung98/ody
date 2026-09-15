/**
 * TanStack Query 키 모음.
 * 모든 useQuery / invalidateQueries 는 반드시 여기 정의된 키를 사용한다.
 * 계층 구조: [도메인, 세부, 파라미터] — 상위 키로 invalidate 하면 하위가 함께 무효화된다.
 */
import type { LayerBox } from "@/types";

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
    /** 레이어별 대표곡 ID */
    representatives: (layer: number) => ["map", "representatives", layer] as const,
    /** 이 곡이 대표곡으로 노출되는 레이어 목록 */
    /** 특정 곡 기준 가까운 곡 */
    nearby: (musicId: number) => ["map", "nearby", musicId] as const,
  },

  music: {
    all: ["music"] as const,
    detail: (id: number) => ["music", "detail", id] as const,
    search: (keyword: string) => ["music", "search", keyword] as const,
    videoId: (id: number) => ["music", "video-id", id] as const,
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
