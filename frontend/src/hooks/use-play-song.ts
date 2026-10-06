"use client";

import { useCallback } from "react";
import { ACTIVITY_CONFIRM, LEAVE_LIST_CONFIRM, RIDING_LOCKED } from "@/constants";
import { playbackActivity, samePlayContext, shouldConfirmListExit, visiblePlayContext } from "@/lib/play-context";
import { DEMO, skipConfirm } from "@/constants/demo";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { isRiding } from "@/stores/use-follow-store";
import { useToastStore } from "@/stores/use-toast-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useMapStore } from "@/stores/use-map-store";
import { runPlaybackTransition, useBlockingStore } from "@/stores/use-blocking-store";

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
  const confirmAsk = useConfirmStore((s) => s.ask);
  // 시연용 (S15P21A405-732): 여정·주변 탐색 중 다른 곡을 열 때 확인 팝업 없이 바로 바꾼다
  const ask = DEMO ? skipConfirm : confirmAsk;

  /**
   * `after` 는 **실제로 틀었을 때만** 돈다. 재생 로그처럼 서버에 남는 일을 여기 넣는다 —
   * 확인창에서 취소했는데 "재생했다" 가 기록되면 안 된다.
   */
  return useCallback(
    (musicId: number, after?: () => void) => {
      /**
       * **따라가는 동안에는 스스로 곡을 고를 수 없다** (2차 실시간 명세 §6, S15P21A405-530).
       * 여기가 단일 곡 재생의 유일한 통로라 한 줄이면 들어오는 길 전부가 막힌다 — 곡 상세,
       * 지도의 별, 검색 결과, 주변 탐색 카드가 모두 이리로 온다.
       *
       * 서버도 `POST /api/music/play` 를 409 `RIDE_NOT_CAPTAIN` 으로 막지만, **누르고 나서
       * 실패를 보는 것보다 안 눌리는 편이 낫다.** 성공한 줄 알고 화면이 먼저 바뀌면 인솔자와
       * 어긋난 자리에 서게 된다.
       *
       * **스스로 곡을 골랐다고 내려 주지는 않는다** (D12). 내리는 것은 하차 버튼으로만 한다.
       *
       * 선단을 따라 곡이 바뀌는 길은 이 통로를 쓰지 않는다 — `lib/realtime/ride.ts` 의
       * `playFrom` 이 플레이어 스토어를 직접 부른다.
       */
      if (isRiding()) {
        useToastStore.getState().show(RIDING_LOCKED);
        return;
      }
      const map = useMapStore.getState();
      // Snapshot the visible exploration. Inferring it later from the player
      // is wrong while the user has opened a new nearby/path view but the old
      // queue is still playing.
      const origin = visiblePlayContext(map, musicId);
      const commit = () => {
        usePlayerStore.getState().playSingle(musicId, origin);
        after?.();
      };
      const { context, queue, currentMusicId } = usePlayerStore.getState();
      if (currentMusicId === musicId && (!origin || samePlayContext(origin, context))) {
        if (!useBlockingStore.getState().busy) commit();
        return;
      }
      const play = () => runPlaybackTransition(commit);
      const currentActivity = playbackActivity(context, queue.length);
      if (origin && currentActivity && !samePlayContext(origin, context)) {
        const next = origin.kind;
        if (next !== "single") {
          ask({
            title: ACTIVITY_CONFIRM.title(next),
            message: ACTIVITY_CONFIRM.message(currentActivity.kind, null, next),
            confirmLabel: ACTIVITY_CONFIRM.confirm,
            cancelLabel: ACTIVITY_CONFIRM.cancel,
            onConfirm: play,
          });
          return;
        }
      }
      // 수동 주변 탐색은 큐가 없어도 같은 탐색 안의 곡이다. 실제 순차 재생 목록을
      // 벗어날 때만 확인한다.
      if (context.kind === "single" || !shouldConfirmListExit(context, queue, musicId, origin)) {
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
