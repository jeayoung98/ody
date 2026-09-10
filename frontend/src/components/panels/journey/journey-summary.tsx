"use client";

import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
import { useRecordPlayMutation } from "@/hooks/mutations/use-record-play-mutation";
import { useStartActivity } from "@/hooks/use-start-activity";
import { formatDuration } from "@/lib/format";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import type { JourneyRoute } from "@/types";

/**
 * 여정 패널 바닥 — 총 재생 시간 · 경로 지우기 · 순차 재생 (PATH-02).
 * 경로를 **만드는** 버튼은 여기 없다. 지점 지정과 경로 생성은 확장 검색창에서만 한다 (JOURNEY-01).
 */
export default function JourneySummary({ route }: { route: JourneyRoute | null }) {
  const reset = useJourneyStore((s) => s.reset);
  const playQueue = usePlayerStore((s) => s.playQueue);
  const clearConstellation = useMapStore((s) => s.clearConstellation);
  const recordPlay = useRecordPlayMutation();
  const startActivity = useStartActivity();

  if (!route) return null;

  // ACT-01: 다른 활동(따라가기·플리)이 진행 중이면 확인 후 멈추고 시작한다
  const handlePlay = () => {
    const ids = route.stops.map((s) => s.id);
    startActivity("journey", `${route.startMusicId}-${route.endMusicId}`, () => {
      playQueue({ kind: "journey", startMusicId: route.startMusicId, endMusicId: route.endMusicId }, ids);
      recordPlay.mutate({ musicId: ids[0], source: "JOURNEY", playedMs: 0 });
    });
  };

  const handleClear = () => {
    reset();
    clearConstellation();
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="lbl">
        총 재생 <b className="num text-sm normal-case tracking-normal text-ink">{formatDuration(route.totalDuration)}</b>
      </span>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleClear}>
          경로 지우기
        </Button>
        <Button size="sm" variant="primary" onClick={handlePlay}>
          <PlayIcon size={12} /> 순차 재생
        </Button>
      </div>
    </div>
  );
}
