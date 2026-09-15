"use client";

import { useCallback } from "react";
import { ACTIVITY_CONFIRM, type ActivityKind } from "@/constants";
import { useStopFollowMutation } from "@/hooks/mutations/use-follow-mutation";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";

interface CurrentActivity {
  kind: ActivityKind;
  /** 같은 종류라도 대상이 다르면 다른 활동으로 본다 (플리 A → 플리 B) */
  targetKey: string;
  detail: string | null;
}

/** 지금 진행 중인 배타 활동 */
function currentActivity(): CurrentActivity | null {
  const f = useFollowStore.getState();
  if (f.leaderEmail) return { kind: "follow", targetKey: f.leaderEmail, detail: f.leaderNickname };
  const p = usePlayerStore.getState();
  if (p.context.kind === "playlist") return { kind: "playlist", targetKey: String(p.context.playlistId), detail: null };
  if (p.context.kind === "journey") return { kind: "journey", targetKey: `${p.context.startMusicId}-${p.context.endMusicId}`, detail: null };
  if (p.context.kind === "nearby") return { kind: "nearby", targetKey: String(p.context.centerMusicId), detail: null };
  return null;
}

/**
 * 배타 활동 시작 (ACT-01).
 * 다른 활동이 진행 중이면 "멈추고 시작할까요?" 팝업을 띄우고, 확인 시 이전 활동을 종료한 뒤 begin 을 실행한다.
 * 같은 대상을 다시 시작하는 경우는 팝업 없이 바로 실행한다.
 */
export function useStartActivity() {
  const ask = useConfirmStore((s) => s.ask);
  const stopFollow = useStopFollowMutation();

  const stopCurrent = useCallback(
    (cur: CurrentActivity) => {
      if (cur.kind === "follow") {
        stopFollow.mutate(cur.targetKey);
        useFollowStore.getState().stop();
        return;
      }
      usePlayerStore.getState().stop();
      useMapStore.getState().clearConstellation();
    },
    [stopFollow],
  );

  return useCallback(
    (next: ActivityKind, targetKey: string, begin: () => void) => {
      const cur = currentActivity();
      if (!cur || (cur.kind === next && cur.targetKey === targetKey)) {
        begin();
        return;
      }
      ask({
        title: ACTIVITY_CONFIRM.title(next),
        message: ACTIVITY_CONFIRM.message(cur.kind, cur.detail, next),
        confirmLabel: ACTIVITY_CONFIRM.confirm,
        cancelLabel: ACTIVITY_CONFIRM.cancel,
        onConfirm: () => {
          stopCurrent(cur);
          begin();
        },
      });
    },
    [ask, stopCurrent],
  );
}
