"use client";

import { useCallback } from "react";
import { ACTIVITY_CONFIRM, type ActivityKind } from "@/constants";
import { DEMO, skipConfirm } from "@/constants/demo";
import { useConfirmStore } from "@/stores/use-confirm-store";
import { ownedMapRepresentation, playbackActivity, type PlaybackActivity } from "@/lib/play-context";
import { dismountRide } from "@/hooks/mutations/use-dismount-mutation";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { runPlaybackTransition } from "@/stores/use-blocking-store";

interface CurrentActivity extends PlaybackActivity {
  detail: string | null;
}

/** 지금 진행 중인 배타 활동 */
function currentActivity(): CurrentActivity | null {
  const f = useFollowStore.getState();
  if (f.leaderEmail) return { kind: "follow", targetKey: f.leaderEmail, detail: f.leaderNickname };
  const p = usePlayerStore.getState();
  const activity = playbackActivity(p.context, p.queue.length);
  return activity ? { ...activity, detail: null } : null;
}

/**
 * 배타 활동 시작 (ACT-01).
 * 다른 활동이 진행 중이면 "멈추고 시작할까요?" 팝업을 띄우고, 확인 시 이전 활동을 종료한 뒤 begin 을 실행한다.
 * 같은 대상을 다시 시작하는 경우는 팝업 없이 바로 실행한다.
 *
 * **주변 탐색 → 주변 탐색은 묻지 않는다** (S15P21A405-384). 중심곡만 옮기는 것이라 "주변 탐색을
 * 멈추고 주변 탐색을 시작할까요" 가 되어 버린다 — 이웃을 타고 걸어 들어가는 동안 매번 뜬다.
 * 여정·플리·따라가기에서 넘어올 때는 그대로 묻는다. 그건 정말로 다른 것을 버리는 일이다.
 */
export function useStartActivity() {
  const confirmAsk = useConfirmStore((s) => s.ask);
  // 시연용 (S15P21A405-732): 활동 전환 확인 팝업 없이 바로 바꾼다
  const ask = DEMO ? skipConfirm : confirmAsk;

  const stopCurrent = useCallback(
    (cur: CurrentActivity) => {
      if (cur.kind === "follow") {
        /**
         * 탑승 중단은 **서버에도 알린다** (S15P21A405-530). 예전에는 로컬 상태만 지웠다 —
         * 하차 API 가 배포에 없었기 때문이다. 화면만 내리면 서버에서는 계속 타고 있어서
         * 인솔자를 따라 곡이 바뀌고, 내가 시작한 새 활동을 그게 덮어쓴다.
         *
         * 기다리지 않는다. 다음 활동은 지금 시작되어야 하고, 실패해도 `dismountRide` 가
         * 화면 쪽 탑승 상태는 걷어낸다.
         */
        void dismountRide().catch(() => {});
        return;
      }
      usePlayerStore.getState().stop();
      const map = useMapStore.getState();
      // Only tear down the representation owned by the activity being stopped.
      // A newly-created journey may already have replaced a nearby/journey view;
      // clearing unconditionally here erased that new route.
      const owned = ownedMapRepresentation(map, cur);
      if (owned === "nearby") map.exitNearby();
      else if (owned === "constellation") map.clearConstellation();
    },
    [],
  );

  return useCallback(
    (next: ActivityKind, targetKey: string, begin: () => void) => {
      const cur = currentActivity();
      if (!cur || (cur.kind === next && (cur.targetKey === targetKey || next === "nearby"))) {
        runPlaybackTransition(begin);
        return;
      }
      ask({
        title: ACTIVITY_CONFIRM.title(next),
        message: ACTIVITY_CONFIRM.message(cur.kind, cur.detail, next),
        confirmLabel: ACTIVITY_CONFIRM.confirm,
        cancelLabel: ACTIVITY_CONFIRM.cancel,
        onConfirm: () => runPlaybackTransition(() => {
          stopCurrent(cur);
          begin();
        }),
      });
    },
    [ask, stopCurrent],
  );
}
