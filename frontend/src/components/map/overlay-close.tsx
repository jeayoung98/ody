"use client";

import { isConstellationOpen, useMapStore } from "@/stores/use-map-store";

/**
 * 오버레이 뷰(별자리·주변 탐색)를 닫는 버튼 (PATH-01-1).
 * 오버레이가 뜨면 지도 조작이 오버레이 안으로 갇히므로, 나가는 길이 한눈에 보여야 한다.
 */
export default function OverlayClose() {
  const viewMode = useMapStore((s) => s.viewMode);
  const constellation = useMapStore(isConstellationOpen);
  const exitNearby = useMapStore((s) => s.exitNearby);
  const toggleConstellation = useMapStore((s) => s.toggleConstellationView);
  const nearby = viewMode === "nearby";
  if (!nearby && !constellation) return null;

  return (
    <button
      type="button"
      onClick={nearby ? exitNearby : toggleConstellation}
      className="glass animate-tin pointer-events-auto absolute top-[62px] left-1/2 z-[23] flex -translate-x-1/2 items-center gap-2 rounded-pill! py-2 pr-3 pl-3.5 text-[12px] text-ink transition-colors hover:border-line-2 hover:bg-white/[.09]"
    >
      <span className={`h-1.5 w-1.5 rounded-pill ${nearby ? "bg-teal shadow-[0_0_8px_#4fe3ce]" : "bg-violet shadow-[0_0_8px_#a67cff]"}`} />
      {nearby ? "주변 탐색" : "별자리 뷰"} 닫기
      <span aria-hidden className="grid h-[18px] w-[18px] place-items-center rounded-pill bg-white/[.09] text-[11px] leading-none text-ink-2">
        ✕
      </span>
    </button>
  );
}
