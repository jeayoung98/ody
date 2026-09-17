"use client";

import IconButton from "@/components/common/icon-button";
import { BackIcon } from "@/components/common/icons";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore, type PanelReturn } from "@/stores/use-panel-store";

/**
 * 곡 상세에서 목록(여정·플리)으로 돌아가는 버튼.
 *
 * 돌아갈 자리를 두 군데서 찾는다 (S15P21A405-316).
 * 1. **어떻게 들어왔나** — 목록에서 곡을 눌러 들어왔거나 주변 음악 카드로 이웃에 들어왔으면
 *    `back` 이 잡혀 있다 (S15P21A405-384)
 * 2. **지금 무엇을 듣고 있나** — 여정·플리가 진행 중이고 이 곡이 그 목록 안에 있으면,
 *    지도에서 바로 눌러 열었더라도 돌아갈 자리가 있다
 *
 * 2번이 없으면 여정 중에 지도에서 그 여정의 별을 눌렀을 때 목록으로 못 돌아간다.
 * 돌아갈 자리가 둘 다 없으면 **아무것도 그리지 않는다.**
 */
export default function PanelBackButton() {
  const back = usePanelStore((s) => s.back);
  const musicId = usePanelStore((s) => s.musicId);
  const goBack = usePanelStore((s) => s.goBack);
  const openJourney = usePanelStore((s) => s.openJourney);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const ids = useMapStore((s) => s.constellationMusicIds);
  const source = useMapStore((s) => s.constellationSource);

  // 지금 켜져 있는 목록 안의 곡인가
  const inList = musicId != null && source != null && ids.includes(musicId);
  const target: PanelReturn | null = back ?? (inList && source.kind === "journey" ? { panel: "journey" } : inList && source.kind === "playlist" ? { panel: "playlist", playlistId: source.playlistId } : null);
  if (!target) return null;

  const handle = () => {
    // 들어온 기록이 있으면 그 길로, 없으면 지금 듣고 있는 목록을 연다
    if (back) goBack();
    else if (target.panel === "song") return;
    else if (target.panel === "journey") openJourney();
    else openPlaylist(target.playlistId);
  };

  return (
    <IconButton label={target.panel === "song" ? "직전 곡으로 돌아가기" : target.panel === "journey" ? "여정으로 돌아가기" : "플레이리스트로 돌아가기"} onClick={handle}>
      <BackIcon />
    </IconButton>
  );
}
