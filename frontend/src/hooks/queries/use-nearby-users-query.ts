import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { NearbyUser } from "@/types";

/** 현재 레이어(영역)에 있는 공개 계정 사용자. 레이어마다 다르고, 실시간성이 필요해 짧게 캐시 */
export function useNearbyUsersQuery(layer: number) {
  return useQuery({
    queryKey: QUERY_KEYS.user.nearby(layer),
    queryFn: () => api<NearbyUser[]>(API_ENDPOINTS.user.nearby(layer)),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}
