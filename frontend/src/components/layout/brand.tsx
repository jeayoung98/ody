"use client";

import LayerStepper from "./layer-stepper";
import LayerSummary from "./layer-summary";
import ViewModeCrumb from "./view-mode-crumb";

/**
 * #brand — 좌상단: 그라데이션 마크 + 워드마크 + 레이어 자취 + 뷰 모드.
 *
 * `별지도 · 8 레이어` 꼬리표는 걷어냈다 (S15P21A405-477) — 여덟 겹이라는 건 바로 아래 자취가
 * 이미 말하고, 첫 화면에서만 잠깐 쓸모 있던 설명이 계속 자리를 차지했다.
 */
export default function Brand() {
  return (
    <div className="pointer-events-none absolute top-4 left-[18px] z-20 flex flex-col gap-[9px]" data-hud>
      <div className="pointer-events-auto flex items-center gap-2.5">
        <span className="grad-bg relative h-[26px] w-[26px] rounded-[10px] shadow-[0_0_22px_-4px_rgba(92,157,255,.75)] after:absolute after:inset-0 after:rounded-[10px] after:bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,.95)_0_12%,transparent_42%)] after:content-['']" />
        <span className="font-display text-2xl leading-none font-bold tracking-[0.26em]">ODY</span>
      </div>
      <LayerStepper />
      <LayerSummary />
      <ViewModeCrumb />
    </div>
  );
}
