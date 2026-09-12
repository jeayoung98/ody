"use client";

import { useState } from "react";
import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";
import AxisCompass from "./axis-compass";
import LayerGauge from "./layer-gauge";
import LayerName from "./layer-name";
import MinimapCanvas from "./minimap-canvas";

/**
 * #instr — 좌하단 계기판: 미니맵 · 깊이 게이지 · 레이어 이름 · 축 나침반.
 * 지도를 넓게 보고 싶을 때가 있어서 접을 수 있다 — 접으면 지금 겹만 남는다.
 */
export default function MinimapPanel() {
  const [open, setOpen] = useState(true);
  const layer = useMapStore((s) => s.layer);

  if (!open) {
    return (
      <button data-hud
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        title="계기판 펼치기"
        className="glass absolute bottom-[18px] left-[18px] z-20 flex items-center gap-2 rounded-pill! py-2 pr-2.5 pl-3 text-[11.5px] text-ink-2 transition-colors hover:text-ink"
      >
        <span className="grad-bg h-1.5 w-1.5 rounded-pill" />
        {LAYER_NAMES[layer]}
        <em className="num text-[9px] tracking-[0.06em] text-teal not-italic">
          L{layer} / {LAYER_COUNT - 1}
        </em>
        <span aria-hidden className="text-[10px] text-ink-3">
          ▲
        </span>
      </button>
    );
  }

  return (
    <aside data-hud className="glass absolute bottom-[18px] left-[18px] z-20 flex w-instrument flex-col gap-[11px] px-3.5 pt-[13px] pb-3.5">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        title="계기판 접기"
        className="absolute top-1.5 right-1.5 grid h-[22px] w-[22px] place-items-center rounded-pill text-[10px] text-ink-3 transition-colors hover:bg-white/[.09] hover:text-ink"
      >
        ▼
      </button>
      <MinimapCanvas />
      <LayerGauge />
      <LayerName />
      <AxisCompass />
    </aside>
  );
}
