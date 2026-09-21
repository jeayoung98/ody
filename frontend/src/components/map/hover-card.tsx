"use client";

import { useEffect, useRef } from "react";
import { HOVER_CARD } from "@/constants";
import type { MapPoint } from "@/types";
import type { MapEngine } from "./engine/map-engine";
import { coverFor } from "./render/sprites";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface HoverCardProps {
  engine: MapEngine;
  /** 호버 중인 곡. null 이면 카드를 그리지 않는다 */
  song: MapPoint | null;
  /** 켜져 있나. 꺼지면 사라지는 중이다 — 다 사라질 때까지는 그대로 붙어 있는다 */
  on: boolean;
}

/**
 * 별 호버 툴팁.
 *
 * **클릭이 통과한다** (S15P21A405-323). 예전에는 300x76 짜리 클릭 가능한 카드였는데, 그 아래
 * 깔린 별을 누를 수가 없었다 — 별 하나를 가리키면 근처 별이 카드에 덮여, 다른 곡을 고르려면
 * 마우스를 치우고 페이드가 끝나기를 기다려야 했다.
 *
 * 이제 아무 이벤트도 받지 않는다. 그래서
 * - 카드에 덮인 별을 **그냥 누르면 된다**
 * - 카드 뒤의 별로 마우스를 옮기면 지도가 그 별을 집어 **툴팁이 바로 그 곡으로 바뀐다**
 * - 카드 위인지 판정하던 로직도, 카드로 가는 동안 붙들어 두던 이유도 사라졌다
 *
 * 재생 버튼도 뺐다. 재생은 별을 다시 누르거나 곡 상세에서 한다.
 *
 * 자리는 카메라가 움직일 때마다 바뀐다. 매 프레임 setState 하면 지도 전체가 리렌더되므로
 * rAF 에서 `style.transform` 만 직접 쓴다 — 리렌더는 곡이 바뀔 때만 일어난다.
 */
export default function HoverCard({ engine, song, on }: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const musicId = song?.musicId ?? null;

  /**
   * 커버를 칠한다. 지도와 **같은 그림**이어야 "아까 그 별" 이 이어진다 (`coverFor`).
   *
   * 진짜 앨범 커버는 받아 온 뒤에야 캔버스가 된다 (S15P21A405-518). 지도는 rAF 로 계속 다시
   * 그려서 저절로 바뀌지만 카드는 한 번 칠하고 끝이라, 도착했는지 잠깐 되물어 본다 —
   * 이미 있으면 첫 칠에서 끝난다. 곡 상세 배경(`song-cover-backdrop`)과 같은 방식이다.
   */
  useEffect(() => {
    const el = coverRef.current;
    if (!el || !song) return;
    let timer = 0;
    let tries = 0;
    const paint = () => {
      el.style.backgroundImage = `url(${coverFor(song).toDataURL()})`;
    };
    const poll = () => {
      timer = 0;
      if (!song.albumMbid || tries++ > 30) return;
      paint();
      timer = window.setTimeout(poll, 150);
    };
    paint();
    timer = window.setTimeout(poll, 150);
    return () => clearTimeout(timer);
  }, [song]);

  useEffect(() => {
    if (musicId == null) return;
    const { w, h, gap, margin } = HOVER_CARD;
    let raf = 0;
    const follow = () => {
      raf = requestAnimationFrame(follow);
      const el = cardRef.current;
      if (!el) return;
      // 나타날 때 한 프레임 늦게 켜야 0 → 1 전환이 실제로 재생된다 (처음 그려질 때는 투명하다)
      // 살짝 비치게 둔다 — 뒤의 별이 비쳐야 "덮은 게 아니라 얹힌 것" 으로 읽힌다
      el.style.opacity = on ? "0.94" : "0";
      const a = engine.hoverAnchor();
      // 별이 화면 밖으로 나가면 카드도 숨긴다 (자리를 못 잡으니 마지막 자리에 남으면 안 된다)
      if (!a) {
        el.style.visibility = "hidden";
        return;
      }
      const f = engine.freeRect();
      const x = clamp(a.px - w / 2, f.x0 + margin, Math.max(f.x0 + margin, Math.min(engine.W, f.x1) - w - margin));
      const top = Math.max(margin, f.y0 + margin);
      const bottom = Math.max(top, Math.min(engine.H, f.y1) - h - margin);
      // 위쪽이 좁으면 별 아래로 내려 붙인다
      const y = clamp(a.py - h - gap < top ? a.py + gap : a.py - h - gap, top, bottom);
      el.style.visibility = "visible";
      el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [engine, musicId, on]);

  if (!song) return null;

  return (
    // z-[25]: HUD 층(계기판·레일·검색·하단바 20~24) 바로 위. 토스트·배너·다이얼로그(30 이상)보다는 아래다.
    // pointer-events 는 항상 꺼 둔다 — 이 카드는 읽는 것이지 누르는 것이 아니다
    <div
      ref={cardRef}
      style={{
        width: HOVER_CARD.w,
        height: HOVER_CARD.h,
        visibility: "hidden",
        opacity: 0,
        transition: `opacity ${HOVER_CARD.fadeMs}ms ease-out`,
      }}
      className="glass-liquid pointer-events-none absolute top-0 left-0 z-[25] flex items-center gap-3 px-2.5 will-change-transform"
    >
      {/* 커버는 캔버스에서 만든 data URL 이다 — 최적화할 원본이 없으니 배경으로 깐다 */}
      <span ref={coverRef} className="h-[54px] w-[54px] shrink-0 rounded-box-xs border border-line bg-cover bg-center" />
      <span className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-ink">{song.title}</p>
        <p className="truncate text-[10.5px] text-ink-2">{song.artist ?? "-"}</p>
        <p className={`num truncate text-2xs ${song.playable ? "text-ink-3" : "text-warn"}`}>
          ▶ {song.weight.toLocaleString()}
          {song.playable ? "" : " · 재생 불가"}
        </p>
      </span>
    </div>
  );
}
