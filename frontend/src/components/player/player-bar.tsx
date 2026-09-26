"use client";

import { useState } from "react";
import { RIDING_LOCKED } from "@/constants";
import { NextIcon, PauseIcon, PlayIcon, PlaylistAddIcon, PrevIcon } from "@/components/common/icons";
import AddToPlaylistDialog from "@/components/panels/playlist/add-to-playlist-dialog";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { usePlayability } from "@/hooks/queries/use-video-id-query";
import { useBackToMap } from "@/hooks/use-back-to-map";
import { useFeatures } from "@/hooks/use-features";
import { useMusicLabel } from "@/hooks/use-music-label";
import { useFollowStore } from "@/stores/use-follow-store";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useToastStore } from "@/stores/use-toast-store";
import { usePlayerStore } from "@/stores/use-player-store";
import LocateButton from "./locate-button";
import PlayerBackdrop from "./player-backdrop";
import ContestRankTag from "./contest-rank-tag";
import PlayerProgress from "./player-progress";
import TransportButton from "@/components/common/transport-button";
import { track } from "@/lib/analytics/client";

/**
 * #transport — 지금 재생 중인 곡. 우하단 376px 기둥에 **세로 3단**으로 쌓는다 (S15P21A405-428):
 *
 *   제목 · 아티스트 (누르면 듣고 있는 것의 패널이 열린다)
 *   파형 진행바
 *   내 위치 ·  ⏮ ▶ ⏭  · 플리에 추가
 *
 * 가로 한 줄이던 것을 세웠다 — 폭이 376 으로 고정된 뒤로 제목이 늘 잘렸다.
 *
 * **모서리는 `glass-liquid` 기본값(`--radius-box` 18px)을 그대로 쓴다** (S15P21A405-668).
 * 예전에는 `rounded-[22px]!` 로 덮었는데, 바로 위에 **같은 폭(376px)으로 우측 패널이 서 있어서**
 * 4px 차이가 그대로 눈에 띄었다. 좌하단 계기판·호버 카드·토스트도 전부 18px 이라 아랫줄에서
 * 이것만 혼자 달랐다.
 * 배경에는 듣는 곡의 커버가 연하게 깔린다 (`player-backdrop.tsx`).
 * 우선순위: 여정 or 플리 > 개인 곡 상세. (여정과 플리는 동시에 켜질 수 없음)
 */
export default function PlayerBar() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const context = usePlayerStore((s) => s.context);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const toggle = usePlayerStore((s) => s.toggle);
  /** 따라가는 동안에는 트랜스포트가 잠긴다 — 재생은 인솔자가 정한다 (2차 명세 §6) */
  const riding = useFollowStore((s) => s.leaderEmail != null);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const showToast = useToastStore((s) => s.show);
  const openSong = usePanelStore((s) => s.openSong);
  const openPlaylist = usePanelStore((s) => s.openPlaylist);
  const openJourney = usePanelStore((s) => s.openJourney);
  const features = useFeatures();
  const backToMap = useBackToMap();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data } = useMusicDetailQuery(currentMusicId);
  /**
   * 제목·아티스트는 **누를 때 받은 것부터** 쓴다 (S15P21A405-585). 상세를 기다리면 트는
   * 순간 `Track 12345` 가 한 박자 떠 있다가 바뀐다 — 누른 쪽은 이미 제목을 알고 있었다.
   */
  const { title, artist } = useMusicLabel(currentMusicId);

  /**
   * 제목을 누르면 지금 듣고 있는 것의 패널을 연다 (PATH-02).
   * 여정·플리면 **별자리도 같이 되살린다** (S15P21A405-316) — 패널을 닫으면 별자리도 같이
   * 꺼지므로, 다시 부르는 길이 여기여야 한다.
   */
  const openContext = () => {
    if (currentMusicId == null) return;
    /**
     * **어느 탭에 있든 지도로 먼저 간다** (S15P21A405-703). 폰에서 랭킹·마이페이지 화면에 있으면
     * 패널이 그 화면 밑에서 열려 눌러도 아무 일이 없어 보였다. 데스크톱은 늘 지도라 그대로다.
     */
    backToMap();
    const map = useMapStore.getState();
    const reopenConstellation = () => {
      if (map.constellationMusicIds.length >= 2 && map.viewMode !== "constellation") map.toggleConstellationView();
    };
    if (context.kind === "playlist") {
      openPlaylist(context.playlistId);
      reopenConstellation();
    } else if (context.kind === "journey") {
      const j = useJourneyStore.getState();
      j.setStart(context.startMusicId);
      j.setEnd(context.endMusicId);
      j.requestRoute();
      openJourney();
      reopenConstellation();
    } else if (context.kind === "nearby") {
      // 주변 탐색은 별자리가 아니라 고리다 — 중심곡으로 뷰를 되살리고 그 상세를 연다 (S15P21A405-359)
      map.enterNearby(context.centerMusicId);
      openSong(context.centerMusicId);
    } else openSong(currentMusicId);
  };

  /** 들을 수 있는 곡인가 — 판단과 문구는 `usePlayability` 한 곳에서 온다 (S15P21A405-364) */
  const { canPlay: playable, blocked, retry } = usePlayability(currentMusicId);
  const canPlay = playable && currentMusicId != null;

  /**
   * 재생은 `youtube-embed.tsx` 가 스토어를 보고 움직이므로 여기서는 토글만 하면 된다.
   *
   * 못 트는 곡이면 **왜 안 되는지 알려 준다** (S15P21A405-336). 예전에는 버튼이 꺼져 있어
   * 눌러도 아무 일도 안 났는데, 그러면 고장으로 읽힌다. 음원이 없는 것과 조회가 실패한 것은
   * 사용자가 할 일이 달라서 문구도 다르다 (S15P21A405-364).
   */
  const handleToggle = () => {
    if (currentMusicId == null) return;
    /**
     * **따라가는 동안에는 재생도 인솔자가 정한다** (2차 실시간 명세 §6, S15P21A405-530).
     * 여기서 멈추면 서버의 선단 상태와 내 소리가 갈라지는데, 서버는 그 사실을 모른다 —
     * 다음 `RIDE_PLAYBACK` 이 올 때까지 조용히 어긋난 채로 남는다.
     */
    if (riding) {
      showToast(RIDING_LOCKED);
      return;
    }
    if (blocked) {
      track("action_blocked", { action: "play", reason: blocked.ref, music_id: currentMusicId });
      showToast(blocked.notice);
      // "잠시 후 다시 눌러 주세요" 가 빈말이 되지 않게, 누른 김에 다시 물어본다 (캐시가 30분이라 저절로는 안 간다)
      if (blocked.retryable) retry();
      return;
    }
    toggle();
  };
  const contextLabel = context.kind === "playlist" ? "플레이리스트" : context.kind === "journey" ? "여정" : context.kind === "nearby" ? "주변 음악" : null;
  const idle = currentMusicId == null;
  const subtitle = idle
    ? "지도에서 별을 눌러 골라보세요"
    : [artist ?? "-", contextLabel && `${contextLabel} 재생 중`, queue.length > 0 && `${queueIndex + 1}/${queue.length}`].filter(Boolean).join(" · ");

  return (
    /*
     * **좁은 화면에서는 세 줄을 한 줄로 접는다** (S15P21A405-417). 데스크톱은
     * `제목 / 진행바 / 컨트롤` 세 줄이라 161px 인데, 812px 짜리 폰에서 그건 화면의 20% 다.
     * 제목과 컨트롤을 나란히 놓고 진행바를 빼면 44px 한 줄 + 여백 = 64px 이고, **97px 이
     * 지도로 돌아온다.** 흔한 미니 플레이어 모양이다.
     *
     * 진행바를 빼는 것이 이 중 유일하게 잃는 것이다 — 바텀시트(S15P21A405-416)를 올리면
     * 그 안에서 전체 플레이어를 보여 주는 것이 다음 자리다.
     *
     * **폰에서는 모서리 없는 반투명 유리다** (S15P21A405-703). 둥글기는 아래 네비 줄이 갖는다(30px).
     * 폰의 `--glass-tint` 는 불투명한 남색이라(`globals.css`) 이 판만 반투명으로 되돌리고, 커버
     * 배경(`player-backdrop`)도 걷는다 — 뒤로 펼쳐진 시트나 별이 비쳐야 한다. 테두리는 걷는다.
     * 위아래 여백은 8 → 12 로 조금 키웠다. 아래에는 네비 뒤로 내려간 30px 이 더 붙는다(`bottom-bar.tsx`).
     */
    <div data-analytics-manual className="glass-liquid relative flex min-w-0 flex-1 flex-col gap-2.5 overflow-visible px-4 pt-3.5 pb-3 max-tablet:flex-row max-tablet:flex-wrap max-tablet:items-center max-tablet:gap-x-2 max-tablet:gap-y-1 max-tablet:rounded-none! max-tablet:border-0 max-tablet:shadow-none max-tablet:px-4 max-tablet:pt-3 max-tablet:pb-[calc(0.75rem+var(--radius-sheet))] max-tablet:[--glass-blur:18px] max-tablet:[--glass-tint:rgb(6_9_17/0.45)]">
      <PlayerBackdrop musicId={currentMusicId} />
      {/* 배경 위에 얹히는 것들은 전부 relative — 아니면 그라데이션 뒤로 들어간다 */}
      <button type="button" onClick={openContext} disabled={idle} className="relative min-w-0 text-left max-tablet:min-w-0 max-tablet:flex-1">
        <p className="truncate font-display text-[17px] leading-tight font-semibold text-ink">
          {idle ? "재생할 곡을 고르세요" : title}
          {!idle && blocked && <span className="ml-2 text-[12.5px] font-normal text-warn">{blocked.badge}</span>}
        </p>
        {/* 고를 곡이 없을 때의 안내는 좁은 화면에서 뺀다 — 한 줄에 제목과 같이 들어가면 둘 다 잘린다 */}
        {/* 가수 · 맥락 · 큐 자리. 13px 이었다 (S15P21A405-649) — 제목이 17px 이라 한 덩어리로 안 읽혔다 */}
        <p className={`mt-0.5 truncate text-[14.5px] text-ink-3 ${idle ? "max-tablet:hidden" : ""}`}>{subtitle}</p>
      </button>
      {/* 이벤트 탑 작품 플리면 순위 태그 — 제목 버튼 안에 넣으면 버튼 속 버튼이라 밖에 둔다 (S15P21A405-684) */}
      <ContestRankTag />

      {/*
        좁은 화면에서는 **아랫줄로 떨어진다** (S15P21A405-417). 부모가 `flex-wrap` 이라
        `w-full` 이면 혼자 다음 줄을 차지한다 — 제목·컨트롤이 윗줄, 진행바가 아랫줄이다.
        파형 높이는 `player-progress.tsx` 가 좁은 화면에서 줄인다.
      */}
      <div className="relative max-tablet:order-last max-tablet:w-full">
        <PlayerProgress musicId={currentMusicId} durationSec={data?.duration} canPlay={canPlay} />
      </div>

      <div className="relative flex items-center justify-between max-tablet:shrink-0 max-tablet:gap-1">
        {/* 내 위치로 가기 — 지도 스토어만 보는 별도 컴포넌트다. 여기 곡이 바뀌어도 다시 그려지지 않는다 */}
        <LocateButton />
        <div className="flex items-center gap-3">
          <TransportButton label="이전" onClick={() => { track("play_prev_requested", { music_id: currentMusicId, at_boundary: queueIndex === 0 }); prev(); }} disabled={riding || queue.length === 0}>
            <PrevIcon />
          </TransportButton>
          <TransportButton label={isPlaying ? "정지" : "재생"} primary size="lg" onClick={handleToggle} dimmed={!canPlay || riding}>
            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </TransportButton>
          <TransportButton label="다음" onClick={() => { track("play_next_requested", { music_id: currentMusicId, at_boundary: queueIndex + 1 >= queue.length }); next(); }} disabled={riding || queue.length === 0}>
            <NextIcon />
          </TransportButton>
        </div>
        {/* 유저 테스트 동안 플리를 감췄다 (S15P21A405-333). 꺼져 있어도 자리는 남겨 이송 버튼이 가운데에 선다 */}
        {features.playlist ? (
          <TransportButton label="플레이리스트에 추가" disabled={idle} onClick={() => setMenuOpen((v) => !v)}>
            <PlaylistAddIcon />
          </TransportButton>
        ) : (
          <span className="h-8 w-8" />
        )}
      </div>

      {/* 화면 가운데 팝업 (S15P21A405-686) — 위로 펼치던 목록은 곡 상세 패널과 겹쳤다 */}
      {features.playlist && menuOpen && currentMusicId != null && <AddToPlaylistDialog musicId={currentMusicId} onDone={() => setMenuOpen(false)} />}
    </div>
  );
}
