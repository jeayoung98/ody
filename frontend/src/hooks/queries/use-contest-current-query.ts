import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { Contest } from "@/types";

/** 지금 열린 회차 (S15P21A405-640). 없으면 `null` — 진입 버튼도 사라진다 */
export function useContestCurrentQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.contest.current,
    queryFn: () => api<Contest | null>(API_ENDPOINTS.contest.current),
    staleTime: 60 * 1000,
  });
}
