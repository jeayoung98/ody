import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestLeaderboard } from "@/types";

/**
 * 리더보드 (S15P21A405-640) — 갤러리·순위가 같은 목록을 쓴다. 서버 정렬은 순위순 하나고 갤러리 정렬은 화면이 한다
 * (`lib/contest-view` `sortEntries`). 채점된(`SCORED`) 작품만 온다.
 */
export function useContestEntriesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.contest.entries,
    queryFn: () => api<ContestLeaderboard>(API_ENDPOINTS.contest.entries),
    staleTime: 30 * 1000,
  });
}
