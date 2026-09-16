"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYBACK_BLOCKED, SKIPPED_UNPLAYABLE } from "@/constants";
import { usePlayability, useVideoIdQuery } from "@/hooks/queries/use-video-id-query";
import { logVideoId } from "@/lib/live-log";
import { playingAction, reportPlayback } from "@/lib/playback-events";
import { useBlockingStore } from "@/stores/use-blocking-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useToastStore } from "@/stores/use-toast-store";
import { registerPlayer, type PlayerHandle } from "./player-registry";

/**
 * 사이트 안 재생 — YouTube **공식 플레이어 임베드** (규칙 6 D15 개정, SONG-03).
 *
 * 음원 파일을 건드리지 않는다. 유튜브가 주는 IFrame Player 를 그대로 띄우고 재생만 시킨다.
 *
 * **플레이어를 미리 만들어 둔다** (S15P21A405-325). 예전에는 첫 재생 때 그 자리에서 만들었는데,
 * 그러면 클릭 → 상세 조회 → 스크립트 로드 → 플레이어 생성 → onReady → `playVideo()` 가 전부
 * 비동기라 **재생 명령이 클릭 제스처에서 멀어졌다.** 브라우저 자동재생 정책이 그걸 막으면
 * 플레이어가 일시정지를 보고하고, 아래 `onStateChange` 가 그 보고를 받아 `isPlaying` 을 false 로
 * 되돌린다 — 눌렀는데 멈춰 있고 한 번 더 눌러야 시작되는 것이 이것 때문이었다.
 *
 * 이제 앱이 뜨면 빈 플레이어를 먼저 올려둔다. 곡이 정해지면 `loadVideoById` 로 갈아끼우기만
 * 하므로, 누르는 시점에 플레이어는 이미 준비돼 있고 재생 명령이 제스처 안에서 걸린다.
 *
 * 의존성을 더하지 않았다. IFrame Player API 는 스크립트 한 줄 + 콜백 하나라 `react-youtube`
 * 같은 래퍼가 없어도 된다.
 */

/** 플레이어 상태 코드 (IFrame API) */
const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const CUED = 5;

/**
 * 곡을 갈아끼운 뒤 재생을 다시 걸어 보는 횟수 (S15P21A405-325).
 *
 * `loadVideoById` 직후에는 플레이어가 새 영상을 세우느라 `playVideo()` 를 삼킨다. 그래서 상태가
 * 미시작·대기로 내려앉는데, 그걸 "사용자가 멈췄다" 로 읽으면 **재생 중에 다른 곡을 누를 때마다
 * 한 번 더 눌러야 했다.** 상태 보고가 올 때마다 다시 걸되, 자동재생이 진짜로 막힌 경우
 * 무한히 매달리지 않게 횟수를 둔다.
 */
const REPLAY_TRIES = 3;

/** 이보다 오래된 응답이면 이번에 조회한 게 아니라 캐시에 있던 것으로 본다 (로그 표시용) */
const CACHE_HIT_MS = 1000;

/** 재생 맥락을 로그에 쓸 한국어 이름으로 (`context.kind` 그대로 찍으면 화면 말과 달라 헷갈린다) */
const CONTEXT_LABEL: Record<string, string> = { single: "단독", playlist: "플리", journey: "여정", nearby: "주변 탐색" };

interface YtPlayer extends PlayerHandle {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  getPlayerState: () => number;
  getVideoUrl: () => string;
  destroy: () => void;
}

/**
 * The constructor returns before the iframe API attaches its methods. Fast
 * Refresh can also preserve `ready=true` while replacing that raw object.
 */
function readyPlayer(value: YtPlayer | null): value is YtPlayer {
  if (!value) return false;
  const player = value as unknown as Record<string, unknown>;
  return ["loadVideoById", "playVideo", "pauseVideo", "stopVideo", "getPlayerState", "getVideoUrl",
    "getCurrentTime", "getDuration", "seekTo", "destroy"].every((key) => typeof player[key] === "function");
}

/** Use the documented current-video URL, not private iframe fields. */
function currentVideoId(player: YtPlayer): string | null {
  try { return new URL(player.getVideoUrl()).searchParams.get("v"); }
  catch { return null; }
}

interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * IFrame API 스크립트는 문서당 한 번만 읽는다. 두 번 넣으면 `onYouTubeIframeAPIReady` 가
 * 덮어써져 먼저 기다리던 쪽이 영영 안 깨어난다.
 */
let apiReady: Promise<void> | null = null;
function loadIframeApi(): Promise<void> {
  if (apiReady) return apiReady;
  apiReady = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiReady;
}

export default function YoutubeEmbed() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  // videoId 는 **전용 엔드포인트**가 출처다 — 상세 응답에 딸려 오던 것을 더 쓰지 않는다 (S15P21A405-340)
  const { status, data, error, dataUpdatedAt } = useVideoIdQuery(currentMusicId);
  const videoId = data?.videoId ?? null;
  const playSeq = usePlayerStore((s) => s.playSeq);
  // 같은 쿼리를 한 번 더 읽는다 — 키가 같아 요청은 그대로 한 번이다
  const { blocked } = usePlayability(currentMusicId);
  const showToast = useToastStore((s) => s.show);

  /**
   * **소리가 날지 안 날지를 곡마다 콘솔에 남긴다** (S15P21A405-363).
   *
   * 여기가 그 판단을 실제로 내리는 유일한 자리다 — 플레이어바·상세의 버튼은 같은 값을 보고
   * 모양만 정한다. 응답이 아니라 **곡을 기준으로** 찍으므로, 캐시라 요청이 안 나간 곡도 남는다.
   *
   * 캐시 여부는 `dataUpdatedAt` 이 방금인지로 본다. `isFetchedAfterMount` 는 못 쓴다 — 이 컴포넌트는
   * 앱이 뜰 때 한 번 붙어 계속 살아 있어서, 아까 상세 화면이 받아둔 값도 "마운트 뒤 조회" 로 세어진다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    const p = usePlayerStore.getState();
    const label = CONTEXT_LABEL[p.context.kind] ?? p.context.kind;
    logVideoId(currentMusicId, {
      status,
      lookup: data?.lookup ?? "unsearched",
      videoId: data?.videoId ?? null,
      error: error as { code?: string; message?: string } | null,
      fromCache: Date.now() - dataUpdatedAt > CACHE_HIT_MS,
      where: p.queue.length ? `${label} ${p.queueIndex + 1}/${p.queue.length}` : label,
    });
  }, [currentMusicId, status, data, error, dataUpdatedAt]);

  /**
   * **찾아봤는데 음원이 없는 곡은 건너뛴다** (S15P21A405-364).
   *
   * 여정·플리를 듣는 중에 그런 곡을 만나면 소리 없이 서 있었다 — 배지를 띄워도 멈춰 있는 건
   * 같아서, 사용자가 직접 ⏭ 를 눌러야 이어졌다.
   *
   * **`notFound` 만 넘긴다.** `unsearched` 와 조회 실패는 다시 부르면 채워질 수 있어서, 넘기면
   * 들을 수 있었을 곡을 버리는 셈이 된다. 그쪽은 안내만 띄우고 사용자가 정하게 둔다.
   *
   * **듣는 중일 때만이다.** 멈춰 두고 정차를 눌러 본 것뿐이면 마음대로 옮기지 않는다.
   *
   * 조용히 넘기지 않는다 — 알리지 않으면 곡이 사라진 것으로 보인다.
   */
  useEffect(() => {
    if (!isPlaying || blocked !== PLAYBACK_BLOCKED.noVideo) return;
    const p = usePlayerStore.getState();
    if (p.currentMusicId !== currentMusicId || p.playSeq !== playSeq || currentMusicId == null) return;
    reportPlayback({ musicId: currentMusicId, playSeq, state: "unavailable", at: Date.now() });
    // 단독 재생은 넘길 곳이 없다. 그 자리에서 안내만 보고 멈춰 있는 게 맞다
    if (p.queue.length === 0) { p.pause(); return; }

    const before = p.currentMusicId;
    // 큐 끝/보류/재개는 전환 통로가 처리한다. 여기서 별도로 pause 하지 않는다.
    p.next();
    const after = usePlayerStore.getState();
    if (after.currentMusicId === before) {
      return;
    }
    showToast(SKIPPED_UNPLAYABLE);
  }, [currentMusicId, playSeq, blocked, isPlaying, showToast]);

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * 곡을 갈아끼운 뒤 "아직 재생을 걸어야 한다" 는 표시. 남은 재시도 횟수를 담는다.
   * 0 이면 더 매달리지 않고 플레이어가 보고하는 대로 받아들인다.
   */
  const wantPlayRef = useRef(0);
  /** 마지막으로 건 재생 번호. 같은 곡이어도 번호가 다르면 다시 건다 (S15P21A405-338) */
  const loadedSeqRef = useRef(-1);
  const loadedMusicRef = useRef<number | null>(null);
  const endedSeqRef = useRef<number | null>(null);
  const startedSeqRef = useRef<number | null>(null);

  /**
   * 플레이어가 스스로 바뀐 상태를 스토어에 되돌린다 — 유튜브 화면에서 직접 누를 수도 있어서
   * 한쪽만 믿으면 버튼 모양과 실제 소리가 어긋난다.
   *
   * 다만 **곡을 갈아끼우는 동안의 미시작·대기·일시정지는 "사용자가 멈춘 것" 이 아니다**
   * (S15P21A405-325). `loadVideoById` 직후 플레이어는 새 영상을 세우느라 `playVideo()` 를
   * 삼키고 상태를 내려놓는데, 그걸 멈춤으로 읽으면 `isPlaying` 이 false 가 되어 버튼이 되돌아가고
   * 한 번 더 눌러야 했다. 그동안은 재생을 다시 건다.
   */
  const onStateChange = useCallback((e: { data: number }) => {
    const p = usePlayerStore.getState();
    const player = playerRef.current;
    // Ignore stale reports during load/lookup, including the previous video's end.
    if (!readyPlayer(player) || p.currentMusicId == null || loadedMusicRef.current !== p.currentMusicId || loadedSeqRef.current !== p.playSeq
      || currentVideoId(player) !== loadedIdRef.current) return;
    if (player.getPlayerState() !== e.data) return;
    const report = (state: "playing" | "paused" | "ended") => reportPlayback({ musicId: p.currentMusicId!, playSeq: p.playSeq, state, at: Date.now() });
    if (e.data === PLAYING) {
      wantPlayRef.current = 0;
      // 멈출 때와 "세지만 않을" 때를 가른다 (S15P21A405-372). 규칙은 `playingAction` 이 갖는다
      const action = playingAction(p.isPlaying, useBlockingStore.getState().busy);
      if (action === "stop") { player.pauseVideo(); return; }
      if (action === "silent") return;
      startedSeqRef.current = p.playSeq;
      endedSeqRef.current = null;
      report("playing");
      return;
    }
    report(e.data === ENDED ? "ended" : "paused");
    if (e.data === ENDED) {
      if (startedSeqRef.current !== p.playSeq || endedSeqRef.current === p.playSeq || useBlockingStore.getState().busy) return;
      endedSeqRef.current = p.playSeq;
      wantPlayRef.current = 0;
      p.next();
      return;
    }
    if (e.data === UNSTARTED || e.data === CUED || e.data === PAUSED) {
      // 카드가 떠 있어도 재생은 다시 건다 — 묻는 동안 소리가 끊기면 답할 근거가 없어진다 (S15P21A405-372)
      if (wantPlayRef.current > 0 && p.isPlaying) {
        wantPlayRef.current -= 1;
        player.playVideo();
        return;
      }
      if (e.data === PAUSED && p.isPlaying) p.pause();
    }
  }, []);

  const onError = useCallback((e: { data: number }) => {
    const p = usePlayerStore.getState();
    if (p.currentMusicId == null || loadedMusicRef.current !== p.currentMusicId || loadedSeqRef.current !== p.playSeq
      || !readyPlayer(playerRef.current) || currentVideoId(playerRef.current) !== loadedIdRef.current) return;
    wantPlayRef.current = 0;
    // Only definitive removed/private/embedding-disabled errors can bridge a gap.
    // Network/HTML5/client errors are unknown, never evidence of unavailability.
    const unavailable = [100, 101, 150].includes(e.data);
    reportPlayback({ musicId: p.currentMusicId, playSeq: p.playSeq, state: unavailable ? "unavailable" : "paused", at: Date.now() });
    if (unavailable && p.queue.length) p.next();
    else p.pause();
  }, []);

  /**
   * 빈 플레이어를 **한 번만** 올린다. 곡은 나중에 갈아끼운다 — 누르는 순간 이미 준비돼 있어야
   * 재생 명령이 제스처 안에서 걸린다 (S15P21A405-325).
   */
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    // Fast Refresh preserves React state but recreates the imperative player.
    setReady(false);
    loadIframeApi().then(() => {
      if (cancelled || !window.YT || playerRef.current) return;
      playerRef.current = new window.YT.Player(host, {
        // playsinline: iOS 가 전체화면으로 튀지 않게. origin: 임베드 호스트 확인용
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        /**
         * **`onReady` 안에서 내놓는다** (S15P21A405-366). 생성자가 돌려주는 객체는 iframe 이
         * 올라오기 전이라 `getCurrentTime`·`getDuration`·`seekTo` 를 아직 갖고 있지 않다.
         * 밖에서 곧바로 등록했더니 진행 바가 250ms 틱마다 꺼내 물어보다 그 창에서 터졌다
         * (`p.getCurrentTime is not a function`). 등록 전에는 `getPlayer()` 가 null 이라
         * 읽는 쪽이 이미 가진 가드에 걸린다 — 아래 다른 사용처들이 `ready` 를 보는 것과 같은 문이다.
         */
        events: {
          onReady: () => {
            if (cancelled || !readyPlayer(playerRef.current)) return;
            setReady(true);
            // 진행 바가 재생 시계를 읽고 위치를 옮길 수 있게 내놓는다 (S15P21A405-334)
            registerPlayer(playerRef.current);
          },
          onStateChange,
          onError,
        },
      });
      // 개발 편의: 콘솔에서 플레이어 상태를 들여다볼 수 있게 (지도 엔진의 `__odyEngine` 과 같은 용도)
      if (process.env.NODE_ENV !== "production") (window as unknown as { __odyPlayer?: YtPlayer }).__odyPlayer = playerRef.current;
    });
    return () => {
      cancelled = true;
      registerPlayer(null);
      if (readyPlayer(playerRef.current)) playerRef.current.destroy();
      playerRef.current = null;
      loadedIdRef.current = null;
      loadedMusicRef.current = null;
    };
  }, [onStateChange, onError]);

  /**
   * 곡 교체. `loadVideoById` 는 스스로 재생을 시작하지만 **그것만 믿지 않는다** — 자동재생이
   * 막히면 조용히 멈춰 있다. 아래 재생·정지 효과가 `videoId` 도 보고 있어서 한 번 더 단언한다.
   *
   * `videoId` 가 없는 곡(검색 링크로 가는 곡)으로 넘어가면 소리를 끊는다. 예전에는 컴포넌트가
   * 통째로 사라지며 플레이어가 버려졌지만, 이제는 계속 살아 있으므로 여기서 멈춰 줘야 한다.
   */
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !readyPlayer(player)) return;
    if (!videoId) {
      if (loadedIdRef.current) {
        player.stopVideo();
        loadedIdRef.current = null;
        loadedMusicRef.current = null;
      }
      return;
    }
    // 번호가 올라갔으면 **같은 영상이어도 다시 건다** — 처음부터 틀라는 뜻이다 (S15P21A405-338)
    if (loadedIdRef.current === videoId && loadedSeqRef.current === playSeq) return;
    loadedSeqRef.current = playSeq;
    loadedIdRef.current = videoId;
    loadedMusicRef.current = currentMusicId;
    startedSeqRef.current = null;
    endedSeqRef.current = null;
    // 틀던 중에 갈아끼우는 것이면 **계속 틀겠다는 뜻**이다. 전환 중 상태 보고에 흔들리지 않게 남긴다
    if (usePlayerStore.getState().isPlaying) wantPlayRef.current = REPLAY_TRIES;
    player.loadVideoById(videoId);
  }, [ready, videoId, playSeq, currentMusicId]);

  // 재생·정지를 스토어에 맞춘다. `videoId` 도 본다 — 곡을 갈아끼운 직후 한 번 더 단언하려고
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !videoId || !readyPlayer(player)) return;
    if (isPlaying) {
      /**
       * **끝난 곡을 다시 트는 것은 새로 거는 것과 같다** (S15P21A405-361). 플레이어가 처음으로
       * 되감고 영상을 다시 세우는 동안 미시작·대기를 보고하는데, 그걸 그대로 받으면 아래
       * `onStateChange` 가 "사용자가 멈췄다" 로 읽어 `isPlaying` 을 되돌린다 — 눌렀더니 0:00 에서
       * 다시 멈추고 한 번 더 눌러야 했다. 곡을 갈아끼울 때와 같은 자리라 같은 재시도를 건다.
       */
      if (player.getPlayerState() === ENDED) wantPlayRef.current = REPLAY_TRIES;
      player.playVideo();
    } else {
      // 사용자가 직접 멈춘 것이니 전환 중 재시도도 접는다
      wantPlayRef.current = 0;
      player.pauseVideo();
    }
  }, [ready, isPlaying, videoId]);

  return (
    /**
     * **지도 뒤에 깔아 화면에서 안 보이게 한다** (2026-09-14 사용자 지정).
     *
     * `-z-10` 이면 루트의 배경보다는 위, `MapView` 보다는 아래에 그려진다. 지도의 `stage-bg` 는
     * 마지막 레이어가 불투명한 `--color-void` 라 통째로 가려진다. iframe 은 DOM 에 그대로 남아
     * 있어서 소리는 계속 난다 — 화면 밖으로 뺀 게 아니라 덮은 것이라 브라우저가 정지시키지 않는다.
     *
     * 크기는 356x200 을 유지한다. 유튜브 임베드 약관의 최소 크기가 200x200 이다.
     *
     * **규칙 6 에는 걸리지 않는다** — 규칙 6 이 금지하는 건 음원 파일 재생·다운로드·스크래핑이고,
     * 여기는 여전히 공식 IFrame Player 를 쓴다. 다만 **유튜브 약관은 플레이어를 가리거나 소리만
     * 쓰는 것을 금지한다.** 그 위험을 알고 고른 구성이다 (S15P21A405-308 코멘트에 기록).
     */
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[86px] left-1/2 -z-10 w-[356px] -translate-x-1/2 overflow-hidden"
    >
      <div className="aspect-video w-full min-h-[200px]">
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
