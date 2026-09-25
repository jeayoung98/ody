"use client";

import { useEffect } from "react";
import { panelFollowTarget } from "@/lib/panel-follow";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 곡 상세 패널이 **재생 곡을 따라간다** (S15P21A405-656).
 *
 * 순차 재생(플리·여정·따라가기)으로 곡이 넘어가도 열려 있던 곡 상세는 이전 곡에 머물러 있었다. 직전 재생 곡의 상세를
 * 보고 있었으면 새 곡으로 갈아 끼운다 — 일부러 다른 곡을 열어 둔 것은 건드리지 않는다 (`panelFollowTarget`).
 *
 * 인솔자·라이더 둘 다 같은 규칙이다. 인솔자 쪽 패널이 바뀌면 `use-ride-captain` 이 `RIDE_PANEL` 로 선단에 옮기고,
 * 라이더 쪽은 `RIDE_TRACK` 이 재생을 넘기는 순간 이 훅이 같은 답을 낸다 — 어느 쪽이 먼저 와도 끝 상태가 같다.
 * 스토어 구독이지 effect 의존성이 아니다 — "바뀐 순간" 만 필요하다.
 */
export function usePanelFollowsTrack(): void {
  useEffect(() => {
    let prev = usePlayerStore.getState().currentMusicId;
    return usePlayerStore.subscribe((s) => {
      const next = s.currentMusicId;
      if (next === prev) return;
      const target = panelFollowTarget(usePanelStore.getState(), prev, next);
      prev = next;
      if (target != null) usePanelStore.getState().followSong(target);
    });
  }, []);
}
