"use client";

import LayerStepper from "./layer-stepper";
import LayerSummary from "./layer-summary";
import ViewModeCrumb from "./view-mode-crumb";

/** #brand — 좌상단: 그라데이션 마크 + 워드마크 + 레이어 스테퍼 + 뷰 모드 */
export default function Brand() {
  return (
    <div className="pointer-events-none absolute top-hud-t left-[18px] z-20 flex flex-col gap-[9px]" data-hud>
      <div className="pointer-events-auto flex items-center gap-2.5">
        <span className="grad-bg relative h-[26px] w-[26px] rounded-[10px] shadow-[0_0_22px_-4px_rgba(92,157,255,.75)] after:absolute after:inset-0 after:rounded-[10px] after:bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,.95)_0_12%,transparent_42%)] after:content-['']" />
        <span className="font-display text-2xl leading-none font-bold tracking-[0.26em]">ODY</span>
        <span className="lbl inline-flex items-center gap-1.5 rounded-pill border border-line bg-white/[.03] px-2 py-[3px] tracking-[0.06em] normal-case">
          별지도 · 8 레이어
        </span>
      </div>
      <LayerStepper />
      <LayerSummary />
      <ViewModeCrumb />
    </div>
  );
}
