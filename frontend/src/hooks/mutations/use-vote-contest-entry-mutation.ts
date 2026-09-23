import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface Input {
  contestId: number;
  entryId: number;
  /** true = 표 주기, false = 거두기 */
  on: boolean;
}

/** 표 주기·거두기. 표 수와 남은 표가 회차·목록 양쪽에 있어 콘테스트 전체를 무효화한다 */
export function useVoteContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, entryId, on }: Input) =>
      api<{ voteCount: number; myVotesLeft: number }>(API_ENDPOINTS.contest.vote(contestId, entryId), { method: on ? "POST" : "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all }),
  });
}
