import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/constants";
import type { ContestMatch, SketchPoint } from "@/types";

interface Input {
  contestId: number;
  points: SketchPoint[];
}

/** 그린 점 → 닮은 배치의 곡 (S15P21A405-598). 결과는 스토어가 들고, 점을 바꾸면 버린다 */
export function useContestMatchMutation() {
  return useMutation({
    mutationFn: ({ contestId, points }: Input) =>
      api<ContestMatch>(API_ENDPOINTS.contest.match(contestId), { method: "POST", body: JSON.stringify({ points }) }),
  });
}
