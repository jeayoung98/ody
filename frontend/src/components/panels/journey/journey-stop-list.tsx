"use client";

import IconButton from "@/components/common/icon-button";
import { PlayIcon } from "@/components/common/icons";
import SectionTitle from "@/components/common/section-title";
import TrackRow from "@/components/common/track-row";
import { JOURNEY_MAX_SONGS } from "@/constants";
import { useStartActivity } from "@/hooks/use-start-activity";
import { rememberMusicHints } from "@/lib/music-hints";
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
   * **고르는 것과 트는 것을 나눈다.** 줄을 누르면 곡 상세만 열고, 재생은 호버했을 때 우측에 나타나는
   * 재생 버튼으로만 한다. 예전에는 줄을 누르는 순간 듣던 곡이 바뀌었다 — 목록을 훑어보려던
   * 사용자는 곡 하나 확인하려다 듣던 자리를 잃는 것으로 겪는다.
   *
   * 버튼이 트는 것은 단일 재생이 아니라 **그 자리부터의 여정 재생**이다 — 큐가 그대로라 이전·다음으로
   * 계속 이어갈 수 있다. 다른 활동(따라가기·플리)이 돌고 있으면 `startActivity` 가 먼저 확인을 받는다 (ACT-01).
   */
  const playFrom = (index: number) => {
    // 큐 전체를 넘긴다 — 다음 곡으로 넘어가도 재생바가 제목을 기다리지 않는다 (S15P21A405-585)
    rememberMusicHints(route.stops);
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
            /* 장르 이름이 사라져 표시할 것이 없다 (S15P21A405-490, A-47) */
            meta={null}
            duration={s.duration}
            active={s.id === currentMusicId}
            onClick={() => openSong(s.id)}
            actions={
              // 호버·키보드 포커스에만 드러낸다. 호버가 없는 기기에서는 늘 보여야 누를 수 있다
              <span className="flex opacity-0 transition-opacity duration-fast group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <IconButton
                  label="이 곡부터 재생"
                  size={26}
                  onClick={(e) => {
                    e.stopPropagation();
                    playFrom(s.order);
                  }}
                >
                  <PlayIcon size={15} />
                </IconButton>
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
