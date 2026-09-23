import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/constants";
import type { ContestJudge, ContestTrack } from "@/types";

interface Input {
  contestId: number;
  tracks: ContestTrack[];
  closed: boolean;
}

/** AI 심사 — 매칭 결과가 나오면 바로 부른다 (즉시 심사). 같은 배치면 같은 답 */
export function useContestJudgeMutation() {
  return useMutation({
    mutationFn: ({ contestId, tracks, closed }: Input) =>
      api<ContestJudge>(API_ENDPOINTS.contest.judge(contestId), { method: "POST", body: JSON.stringify({ tracks, closed }) }),
  });
}
