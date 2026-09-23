"use client";

import { useCallback } from "react";
import { musicToMapPoint } from "@/lib/map-point";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useStartActivity } from "@/hooks/use-start-activity";
import type { MapPoint, PlaylistDetail } from "@/types";

/**
 * 플레이리스트를 재생한다 — **별자리 뷰를 켜면서** (S15P21A405-613).
 *
 * 예전에는 재생해도 별자리가 안 떴다. 패널은 `setConstellationList` 로 **목록만** 걸어 두고
 * ("켜는 건 사용자가 택을 눌렀을 때"), 재생 쪽은 `playQueue` 만 불렀는데 그건 별자리를
 * 건드리지 않는다. 그래서 좌상단 택에는 `별자리 뷰 4곡` 이 떠 있는데 지도에는 아무 일도
 * 안 일어났다 — 재생을 눌렀으니 시작된 줄 알지만 **무엇을 듣고 있는지는 안 보였다.**
 * 여정은 `journey-panel` 이 `showConstellation` 을 불러 처음부터 뷰까지 켰다. 이제 같다.
 *
 * **순차 재생과 이 곡부터 재생이 같은 길을 쓴다** — 둘은 시작 위치만 다른 한 동작인데
 * 화면이 달라질 이유가 없다.
 *
 * 켜는 자리가 `begin` **안**인 것이 중요하다. 앞선 활동을 멈추는 길(`use-start-activity` 의
 * `stopCurrent`)이 `clearConstellation` 을 부르므로, 밖에서 켜면 그 뒤에 지워진다
 * (S15P21A405-302 가 같은 자리에서 난 건이다).
 *
 * 곡이 둘은 돼야 켠다. 하나짜리 플리는 이을 선이 없어서 켜 봐야 빈 오버레이가 덮을 뿐이다
 * (`view-mode-crumb` 의 택도 같은 기준으로 선다).
 */
export function usePlayPlaylist(playlist: PlaylistDetail): (startIndex?: number) => void {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const showConstellation = useMapStore((s) => s.showConstellation);
  const startActivity = useStartActivity();

  return useCallback(
    (startIndex = 0) => {
      const ids = playlist.items.map((it) => it.musicId);
      if (!ids.length) return;
      // 좌표도 함께 넘긴다 (S15P21A405-214) — 이 겹 상주 집합 밖의 곡은 좌표가 있어야 별자리에 그려진다.
      // 좌표가 없는 곡은 빼고 넘긴다 (0 으로 채우면 원점에 뭉친다)
      const points = playlist.items.map((it) => musicToMapPoint(it.music)).filter((p): p is MapPoint => p != null);
      const context = { kind: "playlist", playlistId: playlist.id } as const;
      // ACT-01: 다른 활동(따라가기·여정)이 진행 중이면 확인 후 멈추고 시작한다
      startActivity("playlist", String(playlist.id), () => {
        if (ids.length >= 2) showConstellation(ids, points, context);
        playQueue(context, ids, startIndex);
      });
    },
    [playlist, playQueue, showConstellation, startActivity],
  );
}
