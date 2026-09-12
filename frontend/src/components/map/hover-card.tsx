"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { PlayIcon } from "@/components/common/icons";
import { HOVER_CARD } from "@/constants";
import type { MapPoint } from "@/types";
import type { MapEngine } from "./engine/map-engine";
import { coverFor } from "./render/sprites";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface HoverCardProps {
  engine: MapEngine;
  /** 호버 중인 곡. null 이면 카드를 그리지 않는다 */
  song: MapPoint | null;
  /**
   * 지도가 "마우스가 지금 카드 위인가" 를 판단할 때 쓴다.
   * 들어왔다/나갔다를 플래그로 들고 있으면 **카드가 포인터 밑에서 사라질 때 나간 적이 없는 채로 굳는다** —
   * 지워진 요소는 mouseleave 를 쏘지 않기 때문이다. 실제로 그래서 호버가 영영 안 잡혔다.
   */
  cardRef: RefObject<HTMLDivElement | null>;
  /** 켜져 있나. 꺼지면 사라지는 중이다 — 다 사라질 때까지는 그대로 붙어 있는다 */
  on: boolean;
  /** 카드의 재생 버튼 */
  onPlay: (song: MapPoint) => void;
}

/**
 * 별 호버 카드. 원래는 캔버스로 그렸지만 DOM 으로 옮겼다 (S15P21A405-277) —
 * 카드 위에 마우스를 올려도 사라지지 않아야 하고, 그 안에 **진짜 버튼**이 있어야 하기 때문이다.
 *
 * 자리는 카메라가 움직일 때마다 바뀐다. 매 프레임 setState 하면 지도 전체가 리렌더되므로
 * rAF 에서 `style.transform` 만 직접 쓴다 — 리렌더는 곡이 바뀔 때만 일어난다.
 */
export default function HoverCard({ engine, song, cardRef, on, onPlay }: HoverCardProps) {
  // 커버는 캔버스로 만들어 쓰던 것을 그대로 쓴다 (곡마다 같은 그림이어야 지도와 어긋나지 않는다)
  const cover = useMemo(() => (song ? coverFor(song).toDataURL() : null), [song]);
  const musicId = song?.musicId ?? null;

  useEffect(() => {
    if (musicId == null) return;
    const { w, h, gap, margin } = HOVER_CARD;
    let raf = 0;
    const follow = () => {
      raf = requestAnimationFrame(follow);
      const el = cardRef.current;
      if (!el) return;
      // 나타날 때 한 프레임 늦게 켜야 0 → 1 전환이 실제로 재생된다 (처음 그려질 때는 투명하다)
      el.style.opacity = on ? "1" : "0";
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
  }, [engine, cardRef, musicId, on]);

  if (!song) return null;

  return (
    // z-[25]: HUD 층(계기판·레일·검색·하단바 20~24) 바로 위. 밑에 깔리면 가려진 자리에서
    // 재생 버튼을 누를 수 없다 — 캔버스로 그리던 시절엔 늘 HUD 밑이었다.
    // 토스트·배너·다이얼로그(30 이상)보다는 아래다. 카드 위에서 누른 것은 지도에 넘기지 않는다 —
    // 안 그러면 카드를 잡고 지도가 끌린다
    <div
      ref={cardRef}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        width: HOVER_CARD.w,
        height: HOVER_CARD.h,
        visibility: "hidden",
        opacity: 0,
        transition: `opacity ${HOVER_CARD.fadeMs}ms ease-out`,
        // 사라지는 중인 카드가 그 밑의 별을 가로채면 안 된다
        pointerEvents: on ? "auto" : "none",
      }}
      className="glass absolute top-0 left-0 z-[25] flex cursor-default items-center gap-3 px-2.5 will-change-transform"
    >
      {/* 커버는 캔버스에서 만든 data URL 이다 — 최적화할 원본이 없으니 배경으로 깐다 */}
      <span
        className="h-[54px] w-[54px] shrink-0 rounded-box-xs border border-line bg-cover"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      />
      <span className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-ink">{song.title}</p>
        <p className="truncate text-[10.5px] text-ink-2">{song.artist ?? "-"}</p>
        <p className={`num truncate text-2xs ${song.playable ? "text-ink-3" : "text-warn"}`}>
          ▶ {song.weight.toLocaleString()}
          {song.playable ? "" : " · 재생 불가"}
        </p>
      </span>
      {/* 여기서 재생하면 상세까지 함께 열린다 — 지도 클릭(보기만)과 갈라지는 자리 */}
      <button
        type="button"
        onClick={() => onPlay(song)}
        disabled={!song.playable}
        aria-label={`${song.title} 재생`}
        title={song.playable ? "재생하고 상세 보기" : "재생할 수 없는 곡"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-glass text-ink transition-colors hover:bg-glass-3 hover:text-teal disabled:cursor-default disabled:text-ink-4 disabled:hover:bg-glass"
      >
        <PlayIcon size={15} />
      </button>
    </div>
  );
}
