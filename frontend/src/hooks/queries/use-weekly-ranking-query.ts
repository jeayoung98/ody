import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { WeeklyRanking } from "@/types";

/** 이번 주 랭킹 셋(발견왕·탐험왕·기여도)을 한 번에 (S15P21A405-604). 탭을 갈아타도 다시 안 받는다 */
export function useWeeklyRankingQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.chart.weekly,
    queryFn: () => api<WeeklyRanking>(API_ENDPOINTS.chart.weekly),
    staleTime: 60 * 1000,
  });
}
