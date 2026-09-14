"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMusicDetailQuery } from "@/hooks/queries/use-music-detail-query";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 사이트 안 재생 — YouTube **공식 플레이어 임베드** (규칙 6 D15 개정, SONG-03).
 *
 * 음원 파일을 건드리지 않는다. 유튜브가 주는 IFrame Player 를 그대로 띄우고 재생만 시킨다.
 * **플레이어를 숨기지 않는다** — 화면 밖에 두고 소리만 빼는 건 임베드 약관 위반이다.
 *
 * `videoId` 가 없는 곡에는 아무것도 그리지 않는다. 그 곡은 플레이어바가 검색 링크를
 * 새 탭으로 여는 예전 경로로 간다 (`lib/youtube.ts`).
 *
 * 의존성을 더하지 않았다. IFrame Player API 는 스크립트 한 줄 + 콜백 하나라 `react-youtube`
 * 같은 래퍼가 없어도 된다.
 */

/** 플레이어 상태 코드 (IFrame API) */
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

interface YtPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
}

interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
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
  const { data } = useMusicDetailQuery(currentMusicId);
  const videoId = data?.videoId ?? null;

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * 플레이어가 스스로 바뀐 상태를 스토어에 되돌린다 — 유튜브 화면에서 직접 누를 수도 있어서
   * 한쪽만 믿으면 버튼 모양과 실제 소리가 어긋난다.
   */
  const onStateChange = useCallback((e: { data: number }) => {
    const p = usePlayerStore.getState();
    if (e.data === ENDED) p.next();
    else if (e.data === PAUSED && p.isPlaying) p.pause();
    else if (e.data === PLAYING && !p.isPlaying) p.toggle();
  }, []);

  // 플레이어는 한 번만 만든다. 곡이 바뀌면 같은 플레이어에 영상만 갈아끼운다
  useEffect(() => {
    if (!videoId || playerRef.current || !hostRef.current) return;
    let cancelled = false;
    const host = hostRef.current;
    loadIframeApi().then(() => {
      if (cancelled || !window.YT || playerRef.current) return;
      loadedIdRef.current = videoId;
      playerRef.current = new window.YT.Player(host, {
        videoId,
        // playsinline: iOS 가 전체화면으로 튀지 않게. origin: 임베드 호스트 확인용
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
        events: { onReady: () => setReady(true), onStateChange },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [videoId, onStateChange]);

  // 만들어 둔 플레이어는 페이지를 떠날 때만 버린다
  useEffect(
    () => () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      loadedIdRef.current = null;
    },
    [],
  );

  // 곡 교체
  useEffect(() => {
    if (!ready || !videoId || !playerRef.current) return;
    if (loadedIdRef.current === videoId) return;
    loadedIdRef.current = videoId;
    playerRef.current.loadVideoById(videoId);
  }, [ready, videoId]);

  // 재생·정지를 스토어에 맞춘다
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    if (isPlaying) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [ready, isPlaying]);

  if (!videoId) return null;

  return (
    /**
     * 크기를 줄이지 않는다. 유튜브 임베드 약관이 **최소 200x200** 을 요구해서 356x200 이 16:9 의
     * 하한이다. 더 작게 만들거나 가리면 약관과 규칙 6 의 "공식 플레이어 임베드" 취지에 어긋난다.
     */
    <div data-hud className="glass absolute bottom-[86px] left-1/2 z-[22] w-[356px] max-w-[46vw] -translate-x-1/2 overflow-hidden rounded-[14px]! p-0!">
      <div className="aspect-video w-full min-h-[200px]">
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
