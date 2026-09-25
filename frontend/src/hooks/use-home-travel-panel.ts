"use client";

import { useEffect } from "react";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * "내 위치로 가기" 동안 우측 패널을 접었다가 **도착하면 내 곡 상세로 다시 편다** (S15P21A405-670).
 *
 * 옮겨 가는 동안은 지도가 주인공이라 패널이 화면을 가리면 안 되고, 도착해서 보는 것은 곧 지금 듣는 곡이다.
 * 엔진이 `homeTraveling` 을 켰다 끄는 순간을 스토어 구독으로 듣는다 — 켜지면 접고(닫는 게 아니다, 별자리 등은 산다),
 * 꺼지면 내 곡 상세를 연다. 같은 갈래라 카메라만 옮기는 경우는 켜지지 않으므로 여기서는 아무 일도 없고,
 * 그때는 `locate-button` 이 바로 상세를 연다.
 */
export function useHomeTravelPanel(): void {
  useEffect(() => {
    let prev = useMapStore.getState().homeTraveling;
    return useMapStore.subscribe((s) => {
      if (s.homeTraveling === prev) return;
      prev = s.homeTraveling;
      const panel = usePanelStore.getState();
      if (s.homeTraveling) {
        panel.collapse();
        return;
      }
      const id = s.myMusicId ?? usePlayerStore.getState().currentMusicId;
      if (id != null) panel.openSong(id);
    });
  }, []);
}
