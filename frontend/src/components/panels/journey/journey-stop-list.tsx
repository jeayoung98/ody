"use client";

import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { JOURNEY_MAX_SONGS } from "@/constants";
import { useStartActivity } from "@/hooks/use-start-activity";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import type { JourneyRoute } from "@/types";

/** 경로 위 정거장 곡 목록 (곡 컴포넌트 · 장르 표시). 1루트 최대 30곡 */
export default function JourneyStopList({ route }: { route: JourneyRoute | null }) {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const openSong = usePanelStore((s) => s.openSongFromList);
  const startActivity = useStartActivity();
  if (!route) return null;

  const ids = route.stops.map((s) => s.id);

  /**
   * 정거장을 고르면 **그 자리부터 여정을 듣는다.** 상세만 열고 소리는 그대로 두면
   * 목록을 눌렀는데 아무 일도 안 일어난 것처럼 보인다.
   *
   * 단일 재생이 아니라 여정 재생이다 — 큐가 그대로라 이전·다음으로 계속 이어갈 수 있다.
   * 다른 활동(따라가기·플리)이 돌고 있으면 `startActivity` 가 먼저 확인을 받는다 (ACT-01).
   */
  const handlePick = (musicId: number, index: number) => {
    openSong(musicId);
    startActivity("journey", `${route.startMusicId}-${route.endMusicId}`, () =>
      playQueue({ kind: "journey", startMusicId: route.startMusicId, endMusicId: route.endMusicId }, ids, index),
    );
  };

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
            onClick={() => handlePick(s.id, s.order)}
          />
        ))}
      </div>
    </div>
  );
}
