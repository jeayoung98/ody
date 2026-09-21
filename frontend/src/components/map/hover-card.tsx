"use client";

import { useEffect, useMemo, useRef } from "react";
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
  /**
   * 상세로 들어가는 길 (S15P21A405-417). **좁은 화면에서만 준다.**
   *
   * 폰에서는 별을 탭해도 패널을 열지 않는다 — 열면 지도를 덮어서 다음 별을 못 찾고,
   * 그래서 두 번 탭 재생도 주변 탐색 결과 보기도 막혔다. 대신 이 카드가 뜨고,
   * 상세가 **정말 보고 싶을 때만** 이 버튼으로 들어간다.
   */
  onDetail?: () => void;
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
export default function HoverCard({ engine, song, on, onDetail }: HoverCardProps) {
  // 커버는 캔버스로 만들어 쓰던 것을 그대로 쓴다 (곡마다 같은 그림이어야 지도와 어긋나지 않는다)
  const cover = useMemo(() => (song ? coverFor(song).toDataURL() : null), [song]);
  const cardRef = useRef<HTMLDivElement>(null);
  const musicId = song?.musicId ?? null;
  /**
   * `onDetail` 이 있으면 폰이다 (`map-view.tsx` 가 좁은 화면에서만 넘긴다). 폭도 누를 수 있는지도
   * 이 하나로 갈린다 — 화면 폭을 따로 재면 두 판정이 어긋날 수 있다.
   */
  const narrow = onDetail != null;
  const w = narrow ? HOVER_CARD.wNarrow : HOVER_CARD.w;
  const h = narrow ? HOVER_CARD.hNarrow : HOVER_CARD.h;

  useEffect(() => {
    if (musicId == null) return;
    const { gap, margin } = HOVER_CARD;
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
  }, [engine, musicId, on, w, h]);

  if (!song) return null;

  return (
    // z-[25]: HUD 층(계기판·레일·검색·하단바 20~24) 바로 위. 토스트·배너·다이얼로그(30 이상)보다는 아래다.
    <div
      ref={cardRef}
      /*
       * 폰에서는 **카드 어디를 눌러도 상세로 간다** (S15P21A405-417). 12px 짜리 글자를 정확히
       * 겨누게 하는 건 손가락한테 하는 요구가 아니다. 데스크톱은 그대로 클릭을 통과시킨다
       * (S15P21A405-323) — 거기서는 카드가 마우스를 따라다니며 뜨므로, 눌리게 만들면
       * 카드에 덮인 별을 영영 못 누른다.
       */
      onPointerDown={onDetail ? (e) => e.stopPropagation() : undefined}
      onClick={onDetail}
      role={narrow ? "button" : undefined}
      aria-label={narrow && song ? `${song.title} 상세 열기` : undefined}
      style={{
        width: w,
        height: h,
        visibility: "hidden",
        opacity: 0,
        transition: `opacity ${HOVER_CARD.fadeMs}ms ease-out`,
      }}
      className={`glass-liquid absolute top-0 left-0 z-[25] flex items-center gap-3 px-2.5 will-change-transform ${
        narrow ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
      }`}
    >
      {/* 커버는 캔버스에서 만든 data URL 이다 — 최적화할 원본이 없으니 배경으로 깐다 */}
      <span
        className="h-[54px] w-[54px] shrink-0 rounded-box-xs border border-line bg-cover max-tablet:h-10 max-tablet:w-10"
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      />
      <span className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-ink">{song.title}</p>
        <p className="truncate text-[10.5px] text-ink-2">{song.artist ?? "-"}</p>
        {/*
          재생수 줄은 **폰에서 뺀다** (S15P21A405-417). 카드가 자리를 너무 먹는다는 말이 나왔고,
          이 줄은 상세에 들어가면 그대로 다시 보인다 — 덮은 별 하나를 되찾는 편이 낫다.
        */}
        {!narrow && (
          <p className={`num truncate text-2xs ${song.playable ? "text-ink-3" : "text-warn"}`}>
            ▶ {song.weight.toLocaleString()}
            {song.playable ? "" : " · 재생 불가"}
          </p>
        )}
      </span>
      {/*
        카드가 통째로 눌리므로 이건 **버튼이 아니라 표지판**이다 — "여기 누르면 상세로 간다" 를
        알려 주는 것이 일이다. 그래서 teal 알약으로 확실히 띄운다 (안 보인다는 말이 나왔다).
      */}
      {onDetail && (
        <span
          aria-hidden
          className="shrink-0 rounded-pill border border-teal/40 bg-teal/15 px-2 py-1 text-[11.5px] font-semibold whitespace-nowrap text-teal"
        >
          상세 ›
        </span>
      )}
    </div>
  );
}
