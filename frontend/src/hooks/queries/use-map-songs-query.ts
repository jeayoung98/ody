import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MapPoint } from "@/types";

/** 지도 곡 전체 (PC 16개 포함). 한 번 받으면 세션 동안 유지 */
export function useMapSongsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.map.songs,
    queryFn: () => api<MapPoint[]>(API_ENDPOINTS.map.songs),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
