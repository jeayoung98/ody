import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { withEntryLike, withVotesLeft } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import type { Contest, ContestLeaderboard, ContestLikeResult } from "@/types";

interface Input {
  artworkId: number;
  /** 목표 상태 — true 표 주기, false 거두기 */
  liked: boolean;
}

/**
 * 좋아요 = 표 (S15P21A405-616 · 640). 표 수와 남은 표가 회차·목록 양쪽에 있어 콘테스트 전체를 무효화한다.
 *
 * **누르는 순간 하트·표 수·남은 표가 바뀐다** (S15P21A405-675). 예전에는 목록 전체를 다시 받을 때까지 하트가
 * 그대로라 두 번 누르게 됐다. 실패하면 되돌린다 — 문구는 부르는 쪽(`entry-card`)이 서버 메시지로 띄운다.
 */
export function useLikeContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ artworkId, liked }: Input) => api<ContestLikeResult>(API_ENDPOINTS.contest.like(artworkId), { method: "POST", body: JSON.stringify({ liked }) }),
    onMutate: async ({ artworkId, liked }) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.contest.entries, QUERY_KEYS.contest.current]);
      qc.setQueryData<ContestLeaderboard>(QUERY_KEYS.contest.entries, (prev) => withEntryLike(prev, artworkId, liked));
      qc.setQueryData<Contest | null>(QUERY_KEYS.contest.current, (prev) => withVotesLeft(prev, liked));
      return restore;
    },
    onError: (_e, _input, restore) => restore?.(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all }),
  });
}
