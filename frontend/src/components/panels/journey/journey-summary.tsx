"use client";

import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
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
  const detachContext = usePlayerStore((s) => s.detachContext);
  const clearConstellation = useMapStore((s) => s.clearConstellation);
  const startActivity = useStartActivity();

  if (!route) return null;

  // ACT-01: 다른 활동(따라가기·플리)이 진행 중이면 확인 후 멈추고 시작한다
  const handlePlay = () => {
    const ids = route.stops.map((s) => s.id);
    startActivity("journey", `${route.startMusicId}-${route.endMusicId}`, () => {
      playQueue({ kind: "journey", startMusicId: route.startMusicId, endMusicId: route.endMusicId }, ids);
    });
  };

  /**
   * 경로를 지운다. **플레이어의 맥락도 같이 내린다** (S15P21A405-338).
   *
   * 예전에는 여정 스토어와 별자리만 지워서 `context` 가 여정으로 남았다. 그러면 플레이어바를
   * 누르는 순간 `openContext` 가 그 맥락을 보고 지운 경로를 다시 만들어 되살렸다.
   *
   * **소리는 끊지 않는다** — 듣던 곡은 계속 들리고, 이제 그 곡 하나로만 남는다.
   */
  const handleClear = () => {
    reset();
    clearConstellation();
    detachContext();
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
