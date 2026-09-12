"use client";

import Button from "@/components/common/button";
import Note from "@/components/common/note";
import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { NEARBY_COUNT } from "@/constants";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import type { MusicDetail } from "@/types";

interface SongNearbyListProps {
  items: MusicDetail["nearby"];
  centerMusicId: number;
}

/** .nb10 — 가까운 10곡. 누르면 주변 탐색 모드가 켜지고, 곡을 누르면 그 곡으로 건너간다 */
export default function SongNearbyList({ items, centerMusicId }: SongNearbyListProps) {
  const viewMode = useMapStore((s) => s.viewMode);
  const enterNearby = useMapStore((s) => s.enterNearby);
  const exitNearby = useMapStore((s) => s.exitNearby);
  const selectMusic = useMapStore((s) => s.selectMusic);
  const playSingle = usePlayerStore((s) => s.playSingle);
  const { mutate: recordPlay } = useRecordPlayMutation();
  const openSong = usePanelStore((s) => s.openSong);
  const inNearby = viewMode === "nearby";

  const handleEnter = () => {
    enterNearby(centerMusicId);
    useTutorialStore.getState().complete("nearby");
  };

  /**
   * 이웃 곡을 고른다 — **지도에서 별을 누른 것과 같게 동작해야 한다** (MAP-08).
   *
   * 예전에는 재생을 안 불러서, 기준곡과 상세만 그 곡으로 옮겨가고 **소리는 직전 곡에 머물렀다.**
   * 그러면 "이 곡이 이전 곡과 비슷한가"를 묻는 설문(S15P21A405-250)이 **들어본 적 없는 곡**을
   * 기준으로 물어보게 된다.
   */
  const handlePick = (id: number) => {
    selectMusic(id);
    openSong(id);
    enterNearby(id);
    playSingle(id);
    recordPlay({ musicId: id, source: "MAP", playedMs: 0 });
  };

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={inNearby ? <span className="text-teal">주변 탐색 중</span> : undefined}>주변 음악 {NEARBY_COUNT}곡</SectionTitle>
      <Note>
        <b>유사도</b>는 임베딩 거리 기준. 곡을 누르면 그 곡 주변으로 이어서 옮겨갑니다. 줌아웃하면 주변 탐색이 해제돼요.
      </Note>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {items.map((m, i) => (
          <TrackRow key={m.id} index={i + 1} title={m.title} artist={m.artist} right={`#${i + 1}`} onClick={() => handlePick(m.id)} />
        ))}
      </div>
      {inNearby ? (
        <Button onClick={exitNearby}>주변 탐색 종료 · 전체 맵으로</Button>
      ) : (
        <Button onClick={handleEnter}>주변 탐색 켜기</Button>
      )}
    </div>
  );
}
