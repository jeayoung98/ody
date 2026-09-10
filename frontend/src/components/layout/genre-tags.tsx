"use client";

import type { CSSProperties } from "react";
import { GENRE_NAMES } from "@/constants";
import { genreRgb, rgba } from "@/constants/design-tokens";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 장르 칩 — 프로토타입 `#gfilter` / `.gchip` 값을 그대로 옮겼다 (ody-starmap).
 * 장르는 위치가 아니라 **색·필터**로만 작동한다 — 꺼진 장르는 사라지지 않고 형태만 남는다.
 * 전부 켜져 있을 때는 강조 없이 평평하게 두고, 하나를 누르면 그 장르만 남긴다(솔로).
 * 위치만 프로토타입(상단 중앙)과 달리 우상단이다.
 */

/** .gchip */
const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 9px",
  borderRadius: 99,
  border: "1px solid rgba(255,255,255,.085)",
  background: "rgba(255,255,255,.035)",
  fontSize: 10.5,
  color: "#586a8b",
  backdropFilter: "blur(22px) saturate(1.2)",
  WebkitBackdropFilter: "blur(22px) saturate(1.2)",
  transition: "0.14s",
  whiteSpace: "nowrap",
};

/** .gchip i */
const DOT: CSSProperties = { width: 6, height: 6, borderRadius: 99, flex: "0 0 auto", transition: "0.14s" };

export default function GenreTags() {
  const litGenres = useMapStore((s) => s.litGenres);
  const toggleGenre = useMapStore((s) => s.toggleGenre);
  const showAllGenres = useMapStore((s) => s.showAllGenres);
  const allOn = litGenres.length === GENRE_NAMES.length;

  return (
    <div className="pointer-events-auto absolute top-4 right-[68px] z-[22] flex max-w-[min(34vw,440px)] flex-wrap items-center justify-end gap-1">
      <button
        type="button"
        onClick={showAllGenres}
        className="gchip"
        style={allOn ? { ...CHIP, borderColor: "rgba(255,255,255,.28)", background: "rgba(255,255,255,.1)", color: "#fff" } : CHIP}
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
            className="gchip"
            style={on ? { ...CHIP, borderColor: rgba(rgb, 0.55), background: rgba(rgb, 0.13), color: "#fff" } : CHIP}
          >
            <span style={{ ...DOT, background: rgba(rgb, 1), opacity: off ? 0.22 : 1 }} />
            {name}
          </button>
        );
      })}
    </div>
  );
}
