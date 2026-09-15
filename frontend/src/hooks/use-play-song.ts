"use client";

import { useCallback } from "react";
import { LEAVE_LIST_CONFIRM } from "@/constants";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 곡 하나를 재생하는 **유일한 통로** (S15P21A405-341).
 *
 * 순차 재생(여정·플리) 중에 그 목록 **밖의 곡**을 누르면 듣던 목록이 통째로 닫힌다
 * (`playSingle` 3번 분기가 별자리를 지우고 단독으로 내려놓는다). 예전에는 그걸 말없이 했다 —
 * 사용자는 곡 하나 눌렀을 뿐인데 여정이 사라진 것으로 겪는다. 이제 먼저 물어본다.
 *
 * **큐 안의 곡이면 묻지 않는다.** 목록을 벗어나는 게 아니라 그 안에서 자리를 옮기는 것이고,
 * `playSingle` 도 그 경우는 큐를 지키도록 되어 있다.
 *
 * 다른 **활동**으로 갈아타는 것(여정 → 플리, 따라가기 등)은 여전히
 * [`useStartActivity`](./use-start-activity.ts) 가 맡는다 (ACT-01). 여기는 단일 곡 전용이다.
 */
export function usePlaySong() {
  const ask = useConfirmStore((s) => s.ask);

  /**
   * `after` 는 **실제로 틀었을 때만** 돈다. 재생 로그처럼 서버에 남는 일을 여기 넣는다 —
   * 확인창에서 취소했는데 "재생했다" 가 기록되면 안 된다.
   */
  return useCallback(
    (musicId: number, after?: () => void) => {
      const play = () => {
        usePlayerStore.getState().playSingle(musicId);
        after?.();
      };
      const { context, queue } = usePlayerStore.getState();
      // 순차 재생 중이 아니거나, 그 목록 안의 곡이면 그대로 튼다
      if (context.kind === "single" || queue.includes(musicId)) {
        play();
        return;
      }
      ask({
        title: LEAVE_LIST_CONFIRM.title,
        message: LEAVE_LIST_CONFIRM.message(context.kind, null),
        confirmLabel: LEAVE_LIST_CONFIRM.confirm,
        cancelLabel: LEAVE_LIST_CONFIRM.cancel,
        onConfirm: play,
      });
    },
    [ask],
  );
}
