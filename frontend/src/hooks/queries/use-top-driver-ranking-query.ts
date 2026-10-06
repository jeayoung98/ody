import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS, TOP_DRIVER } from "@/constants";
import type { UserRankingItem } from "@/types";

/**
 * 실시간 탑 버스기사 (S15P21A405-681). 주간 랭킹과 달리 **지금 상태**라 오래 들고 있지 않는다.
 * 서버가 같은 답을 2초 들고 있으므로 그보다 짧게 둘 이유가 없다.
 * 새로고침은 반환값의 `refetch` 로, 첫 로딩(`isPending`)과 다시 받기(`isFetching`)는 부르는 쪽이 가른다.
 *
 * @param enabled 버스기사 탭을 보고 있을 때만. 다른 탭에서 부를 일이 없다
 */
export function useTopDriverRankingQuery(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.chart.topDriver,
    queryFn: () => api<UserRankingItem[]>(API_ENDPOINTS.chart.topDriver),
    staleTime: TOP_DRIVER.staleMs,
    enabled,
  });
}
