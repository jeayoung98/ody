"use client";

import { LocateIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from "@/components/common/icons";
import { genreRgb, rgba } from "@/constants/design-tokens";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { useQueueAutoAdvance } from "@/hooks/use-queue-auto-advance";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useToastStore } from "@/stores/use-toast-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { openYoutube } from "@/lib/youtube";
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
  const goHome = useMapStore((s) => s.goHome);
  const canGoHome = useMapStore((s) => s.canGoHome);
  const viewMode = useMapStore((s) => s.viewMode);
  const showToast = useToastStore((s) => s.show);
  /**
   * 임시 뷰(주변 탐색·별자리)가 떠 있으면 지도를 옮겨도 보이지 않는다.
   * 그래서 **눌리기는 하되** 흐리게 두고, 왜 안 되는지 토스트로 알린다 — 눌렀는데 아무 일도
   * 안 나는 게 제일 나쁘다.
   */
  const overlayOpen = viewMode !== "default";
  const handleGoHome = () => {
    const r = goHome();
    if (r === "overlay") showToast("주변 탐색·별자리 뷰를 닫고 눌러주세요");
    else if (r === "follow") showToast("따라가는 동안에는 화면을 옮길 수 없어요");
  };
  const openSong = usePanelStore((s) => s.openSong);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const openJourney = usePanelStore((s) => s.openJourney);
  const { data } = useMusicDetailQuery(currentMusicId);
  // 큐 재생 중 곡이 끝나면 다음 곡으로 (S15P21A405-258). 같은 쿼리를 보므로 요청이 안 늘어난다
  useQueueAutoAdvance();

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

  /** 사이트 안에서 들을 수 있는 곡인가 — 공식 플레이어 임베드가 붙는다 (규칙 6 D15) */
  const canEmbed = data?.videoId != null;
  const canPlay = data ? canEmbed || data.youtubeUrl != null : currentMusicId != null;

  /**
   * `videoId` 가 있으면 **사이트 안에서** 재생한다 — `youtube-embed.tsx` 가 스토어를 보고 움직이므로
   * 여기서는 토글만 하면 된다.
   *
   * 없으면 예전 경로다: 백엔드가 준 검색 URL 을 새 탭으로 연다 (규칙 6 — `lib/youtube.ts`).
   * **멈춤 → 재생** 으로 넘어갈 때만 연다. 멈출 때도 열면 탭이 계속 쌓인다.
   */
  const handleToggle = () => {
    if (!canEmbed && !isPlaying) openYoutube(data?.youtubeUrl);
    toggle();
  };
  const rgb = data ? genreRgb(data.genres[0]?.id ?? 0) : null;
  const contextLabel = context.kind === "playlist" ? "플레이리스트" : context.kind === "journey" ? "여정" : null;

  return (
    <div className="glass flex min-w-0 flex-1 items-center gap-3 rounded-pill! py-2 pr-3.5 pl-2.5">
      {/* 내 위치로 가기 — 재생으로 내 자리가 정해졌던 겹·화면으로 돌아간다 (MAP-08) */}
      <button
        type="button"
        onClick={handleGoHome}
        disabled={!canGoHome}
        aria-disabled={overlayOpen}
        aria-label="내 위치로 가기"
        title={overlayOpen ? "뷰를 닫고 누르세요" : "내 위치로 가기"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-default disabled:text-ink-4 disabled:hover:bg-transparent ${
          overlayOpen ? "text-ink-4 hover:bg-transparent" : "text-ink-2 hover:bg-white/10 hover:text-teal"
        }`}
      >
        <LocateIcon />
      </button>
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
        <PlayerProgress active={isPlaying && currentMusicId != null} musicId={currentMusicId} durationSec={data?.duration} />
      </button>
      {queue.length > 0 && (
        <span className="num shrink-0 text-[9.5px] tracking-[0.06em] text-teal">
          {queueIndex + 1}/{queue.length}
        </span>
      )}
      <TransportButton label="이전" onClick={prev} disabled={queue.length === 0}>
        <PrevIcon />
      </TransportButton>
      <TransportButton label={isPlaying ? "정지" : canEmbed ? "재생" : "유튜브에서 듣기"} primary onClick={handleToggle} disabled={!canPlay}>
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </TransportButton>
      <TransportButton label="다음" onClick={next} disabled={queue.length === 0}>
        <NextIcon />
      </TransportButton>
    </div>
  );
}
