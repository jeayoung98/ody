"use client";

import { useMapStore } from "@/stores/use-map-store";
import ConstellationChip from "./constellation-chip";

const MODE_LABEL = { default: "기본 뷰", nearby: "주변 탐색 뷰" } as const;

/** .crumb — 현재 맵 뷰 모드 + 별자리 오버레이 칩 */
export default function ViewModeCrumb() {
  const viewMode = useMapStore((s) => s.viewMode);
  const exitNearby = useMapStore((s) => s.exitNearby);
  const on = viewMode !== "default";

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      <span
        className={`glass inline-flex items-center gap-1.5 rounded-pill! px-2.5 py-[5px] text-[11.5px] transition-colors ${
          on ? "border-teal/40 text-ink shadow-glow-teal" : "text-ink-2"
        }`}
      >
        <span className={`h-1 w-1 rounded-pill ${on ? "bg-teal shadow-[0_0_8px_#4fe3ce]" : "bg-ink-4"}`} />
        {MODE_LABEL[viewMode]}
        {on && (
          <button type="button" onClick={exitNearby} className="ml-1 text-ink-3 hover:text-ink" aria-label="뷰 모드 해제">
            ✕
          </button>
        )}
      </span>
      <ConstellationChip />
    </div>
  );
}
