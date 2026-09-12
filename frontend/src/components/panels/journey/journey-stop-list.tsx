"use client";

import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { JOURNEY_MAX_SONGS } from "@/constants";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import type { JourneyRoute } from "@/types";

/** 경로 위 정거장 곡 목록 (곡 컴포넌트 · 장르 표시). 1루트 최대 30곡 */
export default function JourneyStopList({ route }: { route: JourneyRoute | null }) {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const openSong = usePanelStore((s) => s.openSongFromList);
  if (!route) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle aside={`정거장 ${route.stops.length} · 최대 ${JOURNEY_MAX_SONGS}`}>경로</SectionTitle>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {route.stops.map((s) => (
          <TrackRow
            key={s.id}
            index={s.order + 1}
            title={s.title}
            artist={s.artist}
            meta={s.genreName}
            duration={s.duration}
            active={s.id === currentMusicId}
            onClick={() => openSong(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
