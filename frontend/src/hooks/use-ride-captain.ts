"use client";

import { useEffect } from "react";
import { currentPositionMs, publishPanel, publishPlayback, publishView } from "@/lib/realtime/ride";
import { rideViewOf, sameRideView } from "@/lib/realtime/ride-view";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 인솔자가 보내는 것 (2차 실시간 명세 §5, S15P21A405-530).
 *
 * **따라오는 사람이 하나도 없어도 보낸다.** 서버가 스냅샷으로 저장해 뒀다가 나중에 타는
 * 사람에게 같은 지점부터 들려준다 — 안 보내면 중간에 탄 사람이 곡 처음부터 듣는다.
 * 그래서 "내가 인솔자인지" 를 따지지 않는다. 막아야 하는 것은 **내가 따라가는 중일 때**뿐이고,
 * 그 판단은 `publishPlayback`·`publishPanel` 안에 한 번만 두었다.
 *
 * 재생바 이동(`SEEK`)은 여기가 아니라 `player-progress` 의 커밋에서 보낸다 — 끌어 놓은
 * 그 값이 필요한데 스토어에는 재생 위치가 없기 때문이다(초당 여러 번 바뀌는 값이라 일부러 뺐다).
 */
export function useRideCaptain(): void {
  /**
   * 재생·정지. **스토어 구독이지 effect 가 아니다** — `isPlaying` 을 의존성으로 걸면 렌더마다
   * 비교하게 되고, 정작 필요한 "바뀐 순간" 은 구독이 정확히 알려준다.
   *
   * 곡이 바뀌는 것은 보내지 않는다. 그건 `POST /api/music/play` 가 이미 서버에 말했고,
   * 서버가 `RIDE_TRACK` 으로 선단에 옮긴다 (§8.6).
   */
  useEffect(() => {
    let wasPlaying = usePlayerStore.getState().isPlaying;
    return usePlayerStore.subscribe((s) => {
      if (s.isPlaying === wasPlaying) return;
      wasPlaying = s.isPlaying;
      if (s.currentMusicId == null) return;
      publishPlayback(s.isPlaying ? "PLAY" : "PAUSE", currentPositionMs());
    });
  }, []);

  /**
   * 곡 상세 열기·닫기.
   *
   * **탭은 `info` 로 고정이다.** 우리 곡 상세에는 탭이 없다 — 한 장짜리 스크롤이라 나눌 것이
   * 없다. 계약이 값을 요구해서 하나를 골라 싣는 것이고, 받는 쪽도 탭을 보지 않는다.
   */
  useEffect(() => {
    let last: number | null = openSongOf(usePanelStore.getState());
    return usePanelStore.subscribe((s) => {
      const next = openSongOf(s);
      if (next === last) return;
      last = next;
      if (next == null) publishPanel(false);
      else publishPanel(true, next);
    });
  }, []);

  /**
   * 지도를 보는 모양 — 여정·플리 별자리·주변 탐색·기본 (BACKEND-NOTES §8, S15P21A405-653).
   *
   * 스토어의 세 값(`viewMode`·`constellationSource`·`nearbyCenterMusicId`)이 한 화면을 정하므로 그 셋을
   * 한 값으로 접어(`rideViewOf`) **바뀌었을 때만** 보낸다. 별자리 목록만 걸리고 뷰가 꺼진 상태는
   * 기본이다 — 라이더 화면에는 아무것도 안 떠 있다.
   */
  useEffect(() => {
    let last = rideViewOf(useMapStore.getState());
    return useMapStore.subscribe((s) => {
      const next = rideViewOf(s);
      if (sameRideView(next, last)) return;
      last = next;
      publishView(next);
    });
  }, []);
}

/** 지금 열려 있는 곡 상세의 곡. 곡 상세가 아니면 null — 다른 패널은 선단과 공유하지 않는다 */
function openSongOf(s: { activePanel: string | null; musicId: number | null }): number | null {
  return s.activePanel === "song" ? s.musicId : null;
}
