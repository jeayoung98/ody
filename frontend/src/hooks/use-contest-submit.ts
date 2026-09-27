"use client";

import { useCallback } from "react";
import { SKETCH_RULES } from "@/constants";
import { useSubmitContestEntryMutation } from "@/hooks/mutations/use-submit-contest-entry-mutation";
import { roundPhase } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useToastStore } from "@/stores/use-toast-store";
import type { Contest, ContestEntry, ContestMatch } from "@/types";

/**
 * 출품 (S15P21A405-640 · 702). 이름 = 만들어지는 플레이리스트 이름이다. 재출품은 **교체**다 — 서버가 이전 작품을 지우고
 * 점수·좋아요를 초기화한다 (§6-3).
 *
 * 입력칸(`SubmitForm`)과 누르는 버튼이 서로 다른 자리에 선다 — 버튼은 그리기 탭 오른쪽 아래 늘 같은 자리다(702).
 * 그래서 규칙을 여기 한 곳에 둔다.
 */
export function useContestSubmit({ contest, match, my, loggedIn, onSubmitted }: { contest: Contest; match: ContestMatch | null; my: ContestEntry | null; loggedIn: boolean; onSubmitted?: () => void }) {
  const title = useContestStore((s) => s.title);
  const setTitle = useContestStore((s) => s.setTitle);
  const closed = useContestStore((s) => s.closed);
  const clear = useContestStore((s) => s.clear);
  const toast = useToastStore((s) => s.show);
  const mutation = useSubmitContestEntryMutation();

  const open = roundPhase(contest) === "OPEN";
  const trimmed = title.trim().slice(0, SKETCH_RULES.titleMax);
  /** 막힌 까닭. 버튼은 꺼지고 눌러 보면 이 말을 한다 (`GuardedButton`) */
  const blocked = !match ? "먼저 별을 찾아 주세요" : !loggedIn ? "로그인하면 출품할 수 있어요" : !open ? "접수가 끝났어요" : !trimmed ? "별자리 이름을 지어 주세요" : null;

  const submit = useCallback(() => {
    if (mutation.isPending) return;
    if (blocked || !match) {
      if (blocked) toast(blocked);
      return;
    }
    mutation.mutate(match.template ? { title: trimmed, playlistId: match.template.playlistId, closed } : { title: trimmed, musicIds: match.tracks.map((t) => t.musicId), closed }, {
      onSuccess: () => {
        toast(`「${trimmed}」 출품 완료 · AI 채점이 끝나면 여기에 떠요`);
        clear();
        setTitle("");
        onSubmitted?.();
      },
      onError: (e) => toast(e.message),
    });
  }, [blocked, match, trimmed, closed, mutation, toast, clear, setTitle, onSubmitted]);

  return { submit, blocked, pending: mutation.isPending, label: my ? "다시 출품하기" : "출품하기" };
}
