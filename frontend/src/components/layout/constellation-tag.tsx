"use client";

import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";

/**
 * 좌상단 `별자리 뷰` 택 (PATH-01). 볼 수 있는 목록이 있을 때만 뜬다.
 * 누르면 별자리 뷰가 켜지고 다시 누르면 꺼진다 — 목록은 그대로 남아 언제든 다시 켤 수 있다.
 */
export default function ConstellationTag() {
  const ids = useMapStore((s) => s.constellationMusicIds);
  const on = useMapStore((s) => s.viewMode === "constellation");
  const toggle = useMapStore((s) => s.toggleConstellationView);
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  if (ids.length < 2) return null;

  const cursor = currentMusicId == null ? -1 : ids.indexOf(currentMusicId);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "별자리 뷰 끄기" : "별자리 뷰 켜기"}
      className={`glass pointer-events-auto inline-flex items-center gap-1.5 rounded-pill! px-2.5 py-[5px] text-[11.5px] transition-colors duration-fast ${
        on ? "border-violet/45 text-ink shadow-glow-violet" : "text-ink-2 hover:border-line-2 hover:text-ink"
      }`}
    >
      <span className={`h-1 w-1 rounded-pill ${on ? "bg-violet shadow-[0_0_8px_#a67cff]" : "bg-ink-4"}`} />
      별자리 뷰
      <span className="num text-ink-3">{cursor >= 0 ? `${cursor + 1}/${ids.length}` : `${ids.length}곡`}</span>
    </button>
  );
}
