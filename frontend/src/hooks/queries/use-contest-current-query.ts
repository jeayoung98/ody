import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { Contest } from "@/types";

/** 지금 진행 중인 콘테스트 회차 (S15P21A405-602). 없으면 null */
export function useContestCurrentQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.contest.current,
    queryFn: () => api<Contest | null>(API_ENDPOINTS.contest.current),
    staleTime: 60 * 1000,
  });
}
