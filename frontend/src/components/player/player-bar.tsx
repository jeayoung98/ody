"use client";

import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from "@/components/common/icons";
import { genreRgb, rgba } from "@/constants/design-tokens";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { usePlayerStore } from "@/stores/use-player-store";
import PlayerProgress from "./player-progress";
import TransportButton from "./transport-button";

/**
 * #transport — 지금 재생 중인 곡. 곡 정보를 클릭하면 우측 패널이 열린다.
 * 우선순위: 여정 or 플리 > 개인 곡 상세. (여정과 플리는 동시에 켜질 수 없음)
 */
export default function PlayerBar() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const context = usePlayerStore((s) => s.context);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const openSong = usePanelStore((s) => s.openSong);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const openJourney = usePanelStore((s) => s.openJourney);
  const { data } = useMusicDetailQuery(currentMusicId);

  const openContext = () => {
    if (currentMusicId == null) return;
    if (context.kind === "playlist") openPlaylist(context.playlistId);
    else if (context.kind === "journey") {
      const j = useJourneyStore.getState();
      j.setStart(context.startMusicId);
      j.setEnd(context.endMusicId);
      j.requestRoute();
      openJourney();
    } else openSong(currentMusicId);
  };

  const canPlay = data ? data.youtubeUrl != null : currentMusicId != null;
  const rgb = data ? genreRgb(data.genres[0]?.id ?? 0) : null;
  const contextLabel = context.kind === "playlist" ? "플레이리스트" : context.kind === "journey" ? "여정" : null;

  return (
    <div className="glass flex min-w-0 flex-1 items-center gap-3 rounded-pill! py-2 pr-3.5 pl-2.5">
      <span
        className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[9px]"
        style={{ background: rgb ? `linear-gradient(140deg,${rgba(rgb, 0.5)},#13102a)` : "linear-gradient(140deg,#12203c,#1b1330)" }}
      >
        <i className="grad-bg absolute inset-0 opacity-55 [mask:radial-gradient(circle_at_50%_50%,#000_30%,transparent_72%)]" />
      </span>
      <button type="button" onClick={openContext} className="min-w-0 flex-1 text-left" disabled={currentMusicId == null}>
        <p className="truncate text-sm">
          {currentMusicId == null ? "재생할 곡을 지도에서 고르세요" : data?.title ?? `Track ${currentMusicId}`}
          {currentMusicId != null && !canPlay && <span className="ml-2 text-[10px] text-warn">재생 불가</span>}
        </p>
        <p className="truncate text-[10px] text-ink-3">
          {currentMusicId == null ? "" : `${data?.artist ?? "-"}${contextLabel ? ` · ${contextLabel} 재생 중` : ""}`}
        </p>
        <PlayerProgress active={isPlaying && currentMusicId != null} musicId={currentMusicId} />
      </button>
      {queue.length > 0 && (
        <span className="num shrink-0 text-[9.5px] tracking-[0.06em] text-teal">
          {queueIndex + 1}/{queue.length}
        </span>
      )}
      <TransportButton label="이전" onClick={prev} disabled={queue.length === 0}>
        <PrevIcon />
      </TransportButton>
      <TransportButton label={isPlaying ? "정지" : "재생"} primary onClick={toggle} disabled={!canPlay}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </TransportButton>
      <TransportButton label="다음" onClick={next} disabled={queue.length === 0}>
        <NextIcon />
      </TransportButton>
    </div>
  );
}
