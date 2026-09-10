"use client";

import { DRILL, GENRE_NAMES, LAYER_NAMES, LAYER_SONG_COUNT } from "@/constants";
import { genreColor } from "@/constants/design-tokens";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 우상단 — 지금 겹에 별이 몇 개 있고 그중 몇 개가 떠 있는지, 그리고 장르 필터.
 * 겹마다 LAYER_SONG_COUNT 곡이 상주하고, 확대할수록 아래 순위가 드러난다 (REVEAL).
 */
export default function LayerScopeHud() {
  const layer = useMapStore((s) => s.layer);
  const residentCount = useMapStore((s) => s.residentCount);
  const revealedCount = useMapStore((s) => s.revealedCount);
  const zoomK = useMapStore((s) => s.zoomK);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const atBottom = useMapStore((s) => s.atBottom);
  const genreFilter = useMapStore((s) => s.genreFilter);
  const setGenreFilter = useMapStore((s) => s.setGenreFilter);

  const total = residentCount || LAYER_SONG_COUNT;
  const shown = Math.min(revealedCount, total);
  const toNext = Math.min(100, (zoomK / DRILL.gateZoomMul) * 100);

  return (
    <section className="glass pointer-events-auto absolute top-4 right-[68px] z-[22] w-[236px] rounded-[13px]! px-3.5 py-3">
      <header className="flex items-baseline justify-between">
        <h2 className="font-display text-[13px] font-semibold tracking-[0.01em]">
          {LAYER_NAMES[layer]} 별
          <em className="num ml-1.5 text-[9px] tracking-[0.06em] text-teal not-italic">L{layer}</em>
        </h2>
        <span className="lbl">stars</span>
      </header>

      <p className="num mt-1 flex items-baseline gap-1 leading-none">
        <b className="text-[21px] font-semibold text-ink">{shown.toLocaleString()}</b>
        <span className="text-[11px] text-ink-3">/ {total.toLocaleString()}개 떠 있음</span>
      </p>
      <div className="mt-[6px] h-[3px] overflow-hidden rounded-pill bg-white/[.07]">
        <div className="grad-bg h-full rounded-pill transition-[width] duration-fast" style={{ width: `${(shown / total) * 100}%` }} />
      </div>

      <p className="num mt-[7px] text-[9.5px] tracking-[0.04em] text-ink-3">
        {atBottom
          ? `마지막 겹 · 배율 ×${zoomK.toFixed(1)}`
          : gateOpen
            ? `다음 겹 준비됨 — 계속 확대하면 ${LAYER_NAMES[layer + 1]}에서 다시 ${LAYER_SONG_COUNT.toLocaleString()}개`
            : `다음 겹까지 ${toNext.toFixed(0)}% · 확대하면 별이 더 드러납니다`}
      </p>

      <label className="mt-2.5 flex items-center gap-2 border-t border-white/[.06] pt-2.5">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-pill"
          style={
            genreFilter == null
              ? { background: "rgba(147,164,196,.5)" }
              : { background: genreColor(genreFilter), boxShadow: `0 0 10px ${genreColor(genreFilter)}` }
          }
        />
        <select
          aria-label="장르 필터"
          value={genreFilter ?? ""}
          onChange={(e) => setGenreFilter(e.target.value === "" ? null : Number(e.target.value))}
          className="min-w-0 flex-1 cursor-pointer rounded-[7px] border border-line bg-white/[.04] px-2 py-[5px] text-[11.5px] text-ink outline-none transition-colors hover:border-line-2"
        >
          <option value="" className="bg-void">
            장르 전체
          </option>
          {GENRE_NAMES.map((name, id) => (
            <option key={name} value={id} className="bg-void">
              {name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
