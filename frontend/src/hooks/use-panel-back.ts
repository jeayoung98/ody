"use client";

import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore, type PanelReturn } from "@/stores/use-panel-store";

interface PanelBack {
  target: PanelReturn;
  /** 돌아갈 자리의 이름. 곡이면 그 곡 제목 */
  label: string;
  go: () => void;
}

/**
 * 곡 상세에서 **돌아갈 자리**와 그 이름 (S15P21A405-316 · 384).
 *
 * 화살표 버튼과 패널 제목이 **같은 답**을 써야 해서 한 곳에 모았다 — 뒤로갈 곳이 있으면
 * 패널 제목이 `곡 상세` 대신 그 곡 제목이 되고, 화살표는 그 옆에 선다.
 *
 * 돌아갈 자리를 두 군데서 찾는다.
 * 1. **어떻게 들어왔나** — 목록에서 곡을 눌러 들어왔거나 주변 음악 카드로 이웃에 들어왔으면
 *    `back` 이 잡혀 있다
 * 2. **지금 무엇을 듣고 있나** — 여정·플리가 진행 중이고 이 곡이 그 목록 안에 있으면,
 *    지도에서 바로 눌러 열었더라도 돌아갈 자리가 있다
 *
 * 2번이 없으면 여정 중에 지도에서 그 여정의 별을 눌렀을 때 목록으로 못 돌아간다.
 * 둘 다 없으면 `null` 이다 — 부르는 쪽은 아무것도 그리지 않는다.
 */
export function usePanelBack(): PanelBack | null {
  const back = usePanelStore((s) => s.back);
  const musicId = usePanelStore((s) => s.musicId);
  const goBack = usePanelStore((s) => s.goBack);
  const openJourney = usePanelStore((s) => s.openJourney);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const ids = useMapStore((s) => s.constellationMusicIds);
  const source = useMapStore((s) => s.constellationSource);

  // 지금 켜져 있는 목록 안의 곡인가
  const inList = musicId != null && source != null && ids.includes(musicId);
  const target: PanelReturn | null =
    back ??
    (inList && source.kind === "journey"
      ? { panel: "journey" }
      : inList && source.kind === "playlist"
        ? { panel: "playlist", playlistId: source.playlistId }
        : null);

  // 돌아갈 곡의 제목. 방금까지 상세를 보던 곡이라 캐시에 있다
  const { data: backSong } = useMusicDetailQuery(target?.panel === "song" ? target.musicId : null);
  if (!target) return null;

  return {
    target,
    label: target.panel === "song" ? (backSong?.title ?? "직전 곡") : target.panel === "journey" ? "여정" : "플레이리스트",
    go: () => {
      // 들어온 기록이 있으면 그 길로, 없으면 지금 듣고 있는 목록을 연다
      if (back) goBack();
      else if (target.panel === "journey") openJourney();
      else if (target.panel === "playlist") openPlaylist(target.playlistId);
    },
  };
}
