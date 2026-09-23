import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestEntry, ContestTrack } from "@/types";

interface Input {
  contestId: number;
  title: string;
  tracks: ContestTrack[];
  closed: boolean;
}

/** 출품 (재출품이면 대체). 회차 정보(내 출품·남은 재출품)와 목록이 함께 바뀐다 */
export function useSubmitContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, ...body }: Input) =>
      api<ContestEntry>(API_ENDPOINTS.contest.entries(contestId), { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all }),
  });
}
