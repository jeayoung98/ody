"use client";

import { useEffect, useRef } from "react";
import MarqueeText from "@/components/common/marquee-text";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { coverFor } from "@/components/map/render/sprites";
import { NO_GENRE_ID } from "@/constants";

interface SongNearbyCardProps {
  musicId: number;
  title: string;
  artist: string | null;
  /** 가까운 순서. 1부터 */
  rank: number;
  /** 지금 이 곡이 울리고 있나 */
  playing: boolean;
  onClick: () => void;
}

/**
 * 주변 음악 카드 한 장 (SONG-02, S15P21A405-384).
 *
 * **커버가 카드 전체다.** 아래로 검정 그라데이션을 깔고 그 위에 제목·가수만 얹는다.
 * 커버는 지도와 **같은 그림**이다(`coverFor`) — "아까 그 별" 이 이어진다.
 *
 * 진짜 앨범 커버도 여기서 뜬다 (S15P21A405-518). 다만 **주변 곡 응답에는 `albumMbid` 가 없어서**
 * (`NeighborTrack` 필드에 없다) 지도 엔진이 들고 있는 상주 집합에서 빌려 온다. 이 겹에 없는
 * 곡이면 못 찾고 절차적 커버로 떨어진다 — 백엔드가 그 필드를 실어 주면 이 우회가 없어진다.
 *
 * 순위는 좌상단에 작게. 왼→오 순서만으로는 "몇 번째로 가까운 곡" 이 안 나온다.
 *
 * 커버가 정사각이라 카드도 정사각이다 — 늘이면 원본에 없는 여백이 생긴다.
 *
 * 제목·가수가 카드 폭을 넘치면 **옆으로 흐른다**(`MarqueeText`) — 말줄임으로 자르면 긴 제목은
 * 뒷부분을 영영 못 본다. 안 넘치면 아무 일도 안 한다.
 */
export default function SongNearbyCard({ musicId, title, artist, rank, playing, onClick }: SongNearbyCardProps) {
  const coverRef = useRef<HTMLDivElement>(null);

  /** 캔버스는 브라우저에만 있다 — 서버 렌더와 어긋나지 않게 DOM 에 직접 칠한다 */
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    const albumMbid = getMapEngine()?.albumMbidOf(musicId) ?? null;
    const point = { musicId, genreId: NO_GENRE_ID, pc: [], weight: 1, title: "", artist: null, youtubeUrl: null, albumMbid, playable: true };
    let timer = 0;
    let tries = 0;
    const paint = () => {
      el.style.backgroundImage = `url(${coverFor(point).toDataURL()})`;
    };
    // 진짜 커버는 받아 온 뒤에야 생긴다 — 도착했는지 잠깐 되물어 본다 (S15P21A405-518)
    const poll = () => {
      timer = 0;
      if (!albumMbid || tries++ > 30) return;
      paint();
      timer = window.setTimeout(poll, 150);
    };
    paint();
    timer = window.setTimeout(poll, 150);
    return () => clearTimeout(timer);
  }, [musicId]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${title}${artist ? ` · ${artist}` : ""}`}
      className={`group relative aspect-square w-[112px] shrink-0 snap-start overflow-hidden rounded-box-sm border text-left transition-colors duration-fast ${
        playing ? "border-teal/70" : "border-line hover:border-line-2"
      }`}
    >
      <div ref={coverRef} aria-hidden className="absolute inset-0 bg-cover bg-center transition-transform duration-normal ease-spring group-hover:scale-[1.06]" />
      {/* 글자 자리만 어둡게 — 커버 위쪽은 그대로 보여 준다 */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-void via-void/70 via-38% to-transparent to-72%" />
      <span className="num absolute top-1 left-2 text-[10px] text-ink-2 drop-shadow-[0_1px_4px_rgba(4,6,13,.9)]">#{rank}</span>
      {playing && <span className="absolute top-1 right-2 text-[9px] text-teal drop-shadow-[0_1px_4px_rgba(4,6,13,.9)]">▶</span>}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-px px-2 pb-2">
        <MarqueeText text={title} className="text-[12px] leading-tight font-medium text-ink drop-shadow-[0_1px_5px_rgba(4,6,13,.95)]" />
        <MarqueeText text={artist ?? "Unknown"} className="text-[10.5px] leading-tight text-ink-3 drop-shadow-[0_1px_5px_rgba(4,6,13,.95)]" />
      </span>
    </button>
  );
}
