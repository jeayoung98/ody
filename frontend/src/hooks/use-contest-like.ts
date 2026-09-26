"use client";

import { useCallback } from "react";
import { useLikeContestEntryMutation } from "@/hooks/mutations/use-like-contest-entry-mutation";
import { roundPhase } from "@/lib/contest-view";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry } from "@/types";

/**
 * 작품 좋아요 = 표 (S15P21A405-616 · 702). 갤러리 카드와 순위(탑 3·목록)가 같은 규칙을 쓴다 —
 * 두 벌로 두면 한쪽만 "표를 다 썼어요" 를 안 막는다.
 *
 * - 로그인 전·내 작품·접수가 끝난 회차에는 못 준다
 * - 회차당 남의 작품 `voteLimit` 개. 다 썼으면 거두기만 된다
 */
export function useContestLike(contest: Contest, meEmail: string | null) {
  const toast = useToastStore((s) => s.show);
  const like = useLikeContestEntryMutation();
  const open = roundPhase(contest) === "OPEN";

  const canLike = useCallback((entry: ContestEntry) => open && !(meEmail != null && entry.ownerEmail === meEmail), [open, meEmail]);

  const toggle = useCallback(
    (entry: ContestEntry) => {
      if (!meEmail) return toast("로그인하면 좋아요를 줄 수 있어요");
      if (!entry.likedByMe && contest.myVotesLeft === 0) return toast("좋아요를 모두 썼어요. 다른 별자리의 좋아요를 거두면 다시 줄 수 있어요");
      like.mutate({ artworkId: entry.artworkId, liked: !entry.likedByMe }, { onError: (e) => toast(e.message) });
    },
    [meEmail, contest.myVotesLeft, like, toast],
  );

  return { toggle, canLike, pending: like.isPending };
}
