import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { JourneyRoute } from "@/types";

/** 출발/도착이 모두 지정되고 enabled일 때만 경로를 요청 */
export function useJourneyRouteQuery(startId: number | null, endId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.journey.route(startId ?? -1, endId ?? -1),
    queryFn: () => api<JourneyRoute>(`${API_ENDPOINTS.journey.route}?start=${startId}&end=${endId}`),
    enabled: enabled && startId != null && endId != null,
    staleTime: 10 * 60 * 1000,
  });
}
