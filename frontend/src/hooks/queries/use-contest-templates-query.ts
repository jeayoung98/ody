import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestTemplate } from "@/types";

/** AI 추천 모양 목록 (S15P21A405-595). 회차와 무관하게 고정이라 오래 들고 있는다. 로그인 전에는 부르지 않는다 */
export function useContestTemplatesQuery(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.contest.templates,
    queryFn: () => api<ContestTemplate[]>(API_ENDPOINTS.contest.templates),
    enabled,
    staleTime: 30 * 60 * 1000,
  });
}
