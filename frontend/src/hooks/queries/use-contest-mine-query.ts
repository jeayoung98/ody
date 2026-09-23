import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CONTEST_SCORING_POLL_MS, QUERY_KEYS } from "@/constants";
import { awaitingScore } from "@/lib/contest-view";
import type { ContestEntry } from "@/types";

/**
 * 내 작품 (S15P21A405-640). 출품 응답은 늘 `PENDING` 이고 소켓 알림이 없어서(§6-2) **채점을 기다리는 동안만** 5초마다
 * 다시 읽는다. 로그인 전에는 부르지 않는다 — 401 이 확정된 요청이다.
 */
export function useContestMineQuery(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.contest.mine,
    queryFn: () => api<ContestEntry[]>(API_ENDPOINTS.contest.mine),
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: (q) => (awaitingScore(q.state.data) ? CONTEST_SCORING_POLL_MS : false),
  });
}
