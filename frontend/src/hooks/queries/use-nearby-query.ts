import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { NearbyResponse } from "@/types";

/** 특정 곡 기준 가까운 곡. musicId가 null이면 요청하지 않는다 */
export function useNearbyQuery(musicId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.map.nearby(musicId ?? -1),
    queryFn: () => api<NearbyResponse>(API_ENDPOINTS.map.nearby(musicId!)),
    enabled: musicId != null,
    staleTime: 5 * 60 * 1000,
  });
}
