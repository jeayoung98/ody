"use client";

import { useEffect } from "react";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 막는 창 때문에 미뤄 둔 "다음 곡" 을 창이 닫히면 넘긴다 (S15P21A405-258).
 *
 * ## 왜 필요한가
 *
 * 자동 넘김은 임베드 플레이어의 `ended` 이벤트가 한다 (S15P21A405-308). 그런데 곡이 끝나는
 * 순간은 **한 번뿐이다.** 설문처럼 답을 강제하는 창이 떠 있는 동안 그 순간이 지나가면,
 * 그냥 무시할 경우 끝난 곡에 영영 머문다.
 *
 * 그래서 `usePlayerStore.next()` 가 막혀 있으면 `pendingNext` 로 예약만 걸고, 여기서
 * 창이 닫히는 것을 보고 대신 넘긴다.
 *
 * ## 왜 여기서 하나
 *
 * 예약을 푸는 쪽이 막는 쪽(설문)을 알면 안 된다 — 설문은 언젠가 통째로 지울 기능이라,
 * 재생 코드가 그걸 알면 지울 때 재생까지 손봐야 한다. 여기서는 "아무도 안 막는다" 만 본다.
 */
export function useDeferredNext() {
  const blocked = useBlockingStore((s) => s.blockers.size > 0);
  const pendingNext = usePlayerStore((s) => s.pendingNext);
  const next = usePlayerStore((s) => s.next);

  useEffect(() => {
    if (blocked || !pendingNext) return;
    next();
  }, [blocked, pendingNext, next]);
}
