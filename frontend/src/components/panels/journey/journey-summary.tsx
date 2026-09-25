"use client";

import Button from "@/components/common/button";
import { PlayIcon } from "@/components/common/icons";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useStartActivity } from "@/hooks/use-start-activity";
import { formatDuration } from "@/lib/format";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { rememberMusicHints } from "@/lib/music-hints";
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
  const openComposer = useOpenJourneyComposer();

  if (!route) return null;

  // ACT-01: 다른 활동(따라가기·플리)이 진행 중이면 확인 후 멈추고 시작한다
  const handlePlay = () => {
    const ids = route.stops.map((s) => s.id);
    // 정거장 제목을 미리 넘겨 둔다 — 곡이 넘어갈 때마다 `Track <id>` 가 스치지 않게 (S15P21A405-585)
    rememberMusicHints(route.stops);
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
   *
   * **지운 자리에 빈 패널을 남기지 않는다** (S15P21A405-661). 경로를 지웠다는 것은 다시 만들겠다는 뜻이라
   * 패널을 닫고 확장 검색창을 연다 — 지점을 고치는 유일한 통로다 (JOURNEY-01). 출발은 그 훅의 규칙대로
   * 지금 듣는 곡으로 채워지고 차례는 도착이다; 비우려면 ✕.
   */
  const handleClear = () => {
    reset();
    clearConstellation();
    detachContext();
    openComposer();
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
          <PlayIcon size={14} /> 순차 재생
        </Button>
      </div>
    </div>
  );
}
