import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestLikeResult } from "@/types";

interface Input {
  artworkId: number;
  /** 목표 상태 — true 표 주기, false 거두기 */
  liked: boolean;
}

/** 좋아요 = 표 (S15P21A405-616 · 640). 표 수와 남은 표가 회차·목록 양쪽에 있어 콘테스트 전체를 무효화한다 */
export function useLikeContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ artworkId, liked }: Input) => api<ContestLikeResult>(API_ENDPOINTS.contest.like(artworkId), { method: "POST", body: JSON.stringify({ liked }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all }),
  });
}
