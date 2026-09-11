"use client";

import { useMapStore } from "@/stores/use-map-store";
import ConstellationTag from "./constellation-tag";

/**
 * .crumb — 지금 어떤 뷰인지 (PATH-01-1: 기본 / 주변 탐색 / 별자리 중 하나).
 * 별자리 뷰는 옆의 택이 상태와 토글을 겸하므로 여기서는 표시하지 않는다 (라벨 중복 방지).
 */
export default function ViewModeCrumb() {
  const viewMode = useMapStore((s) => s.viewMode);
  const exitNearby = useMapStore((s) => s.exitNearby);
  const nearby = viewMode === "nearby";

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1">
      {viewMode !== "constellation" && (
        <span
          className={`glass inline-flex items-center gap-1.5 rounded-pill! px-2.5 py-[5px] text-[11.5px] transition-colors ${
            nearby ? "border-teal/40 text-ink shadow-glow-teal" : "text-ink-2"
          }`}
        >
          <span className={`h-1 w-1 rounded-pill ${nearby ? "bg-teal shadow-[0_0_8px_#4fe3ce]" : "bg-ink-4"}`} />
          {nearby ? "주변 탐색 뷰" : "기본 뷰"}
          {nearby && (
            <button type="button" onClick={exitNearby} className="ml-1 text-ink-3 hover:text-ink" aria-label="주변 탐색 끄기">
              ✕
            </button>
          )}
        </span>
      )}
      <ConstellationTag />
    </div>
  );
}
