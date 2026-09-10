"use client";

import { GENRE_NAMES } from "@/constants";
import { genreRgb, rgba } from "@/constants/design-tokens";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 우상단 장르 칩 (프로토타입 #gfilter / .gchip 그대로).
 * 장르는 위치가 아니라 **색·필터**로만 작동한다 — 꺼진 장르는 사라지지 않고 형태만 남는다.
 * 전부 켜져 있을 때는 강조 없이 평평하게 두고, 하나를 누르면 그 장르만 남긴다(솔로).
 */
export default function GenreTags() {
  const litGenres = useMapStore((s) => s.litGenres);
  const toggleGenre = useMapStore((s) => s.toggleGenre);
  const showAllGenres = useMapStore((s) => s.showAllGenres);
  const allOn = litGenres.length === GENRE_NAMES.length;

  const base =
    "inline-flex items-center gap-[5px] whitespace-nowrap rounded-pill border border-line px-[9px] py-[4px] text-[10.5px] backdrop-blur-[28px] transition-all duration-fast";

  return (
    <div className="pointer-events-auto absolute top-4 right-[68px] z-[22] flex max-w-[min(32vw,440px)] flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={showAllGenres}
        className={`${base} ${allOn ? "border-white/[.28] bg-white/10 text-ink" : "bg-white/[.035] text-ink-3 hover:border-line-2 hover:text-ink"}`}
      >
        전체
      </button>
      {GENRE_NAMES.map((name, id) => {
        const on = !allOn && litGenres.includes(id);
        const off = !allOn && !on;
        const rgb = genreRgb(id);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => toggleGenre(id)}
            className={`${base} ${on ? "text-white" : "bg-white/[.035] text-ink-3 hover:border-line-2 hover:text-ink"}`}
            style={on ? { borderColor: rgba(rgb, 0.55), background: rgba(rgb, 0.13) } : undefined}
          >
            <span
              className="h-[6px] w-[6px] shrink-0 rounded-pill transition-all duration-fast"
              style={{ background: rgba(rgb, 1), opacity: off ? 0.22 : 1 }}
            />
            {name}
          </button>
        );
      })}
    </div>
  );
}
