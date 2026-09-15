import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, FEATURES, QUERY_KEYS } from "@/constants";
import type { NearbyUser } from "@/types";

/**
 * 현재 레이어(영역)에 있는 공개 계정 사용자. 레이어마다 다르고, 실시간성이 필요해 짧게 캐시.
 *
 * **여기가 "지도 위 사람" 기능의 유일한 수원지다** (S15P21A405-333). 잠그면 표식·따라가기
 * 대상·목 반응이 한꺼번에 사라지고 15초 폴링도 멈춘다 — 화면마다 따로 막을 필요가 없다.
 */
export function useNearbyUsersQuery(layer: number) {
  return useQuery({
    queryKey: QUERY_KEYS.user.nearby(layer),
    queryFn: () => api<NearbyUser[]>(API_ENDPOINTS.user.nearby(layer)),
    enabled: FEATURES.social,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });
}
