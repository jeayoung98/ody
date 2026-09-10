import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS, type ChartType } from "@/constants";
import type { PlaylistRankingItem, UserRankingItem } from "@/types";

export function useUserRankingQuery(type: Exclude<ChartType, "topPlaylist">) {
  return useQuery({
    queryKey: QUERY_KEYS.chart.ranking(type),
    queryFn: () => api<UserRankingItem[]>(API_ENDPOINTS.chart.ranking(type)),
    staleTime: 60 * 1000,
  });
}

export function usePlaylistRankingQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.chart.ranking("topPlaylist"),
    queryFn: () => api<PlaylistRankingItem[]>(API_ENDPOINTS.chart.ranking("topPlaylist")),
    staleTime: 60 * 1000,
  });
}
