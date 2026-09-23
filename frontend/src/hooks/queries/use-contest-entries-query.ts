import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestEntry, ContestSort } from "@/types";

/** 갤러리·순위 목록. 정렬은 서버가 한다 — `final` 이 곧 순위다 */
export function useContestEntriesQuery(contestId: number | null, sort: ContestSort) {
  return useQuery({
    queryKey: QUERY_KEYS.contest.entries(contestId ?? -1, sort),
    queryFn: () => api<ContestEntry[]>(API_ENDPOINTS.contest.entries(contestId!, sort)),
    enabled: contestId != null,
    staleTime: 30 * 1000,
  });
}
