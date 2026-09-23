import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

/** 채점에 실패한 내 작품을 다시 평가받는다 (S15P21A405-640). 3회까지 */
export function useRetryContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (artworkId: number) => api<{ artworkId: number }>(API_ENDPOINTS.contest.retry(artworkId), { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.mine }),
  });
}
