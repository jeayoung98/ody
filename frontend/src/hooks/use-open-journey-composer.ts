"use client";

import { useCallback } from "react";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 여정을 열 때 출발에 넣을 곡. `null` 이면 손대지 않는다 (S15P21A405-437).
 *
 * **내 위치가 출발점이다.** 이 서비스에서 내 위치 = 지금 듣는 곡이고 (MAP-08, `map-engine`
 * 의 `travelTo`), 여정은 있는 자리에서 출발하는 것이 기본이다. 곡 상세에서 `도착점으로` 를
 * 누르면 그것만으로 출발·도착이 다 서서 바로 경로를 만들 수 있다.
 *
 * 두 가지는 채우지 않는다.
 * - **출발이 이미 있으면** — `출발점으로` 는 자기 곡을 넣고 오므로 덮어쓰면 안 된다
 * - **도착과 같은 곡이면** — 같은 두 지점으로는 경로가 안 서는데, 칸만 채워 놓으면
 *   `경로 만들기` 가 왜 안 눌리는지 알 길이 없다
 */
export function journeyStartFor(
  startMusicId: number | null,
  endMusicId: number | null,
  playingMusicId: number | null,
): number | null {
  if (startMusicId != null || playingMusicId == null) return null;
  return playingMusicId === endMusicId ? null : playingMusicId;
}

/**
 * 여정 지점을 고치는 유일한 통로 = 상단 확장 검색창 (JOURNEY-01).
 * 어디서 눌렀든 우측 패널은 닫고 확장 검색을 연다 — 검색창과 사이드 패널은 함께 뜨지 않는다.
 *
 * **출발이 비어 있으면 지금 듣는 곡으로 채운다** — {@link journeyStartFor} 참고 (S15P21A405-437).
 */
export function useOpenJourneyComposer() {
  const openComposer = useJourneyStore((s) => s.openComposer);
  const setStart = useJourneyStore((s) => s.setStart);
  const setPickTarget = useJourneyStore((s) => s.setPickTarget);
  const closePanel = usePanelStore((s) => s.close);

  return useCallback(
    (target?: "start" | "end") => {
      closePanel();
      /**
       * 채운 뒤에도 `target` 은 그대로 쓴다 — 출발 칸이 포커스된 채로 열리므로 자동으로
       * 들어온 곡이 마음에 안 들면 그 자리에서 바꾼다.
       */
      const { startMusicId, endMusicId } = useJourneyStore.getState();
      const start = journeyStartFor(startMusicId, endMusicId, usePlayerStore.getState().currentMusicId);
      if (start != null) setStart(start);
      openComposer();
      if (target) setPickTarget(target);
    },
    [closePanel, openComposer, setStart, setPickTarget],
  );
}
