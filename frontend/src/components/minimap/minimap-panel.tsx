"use client";

import AxisCompass from "./axis-compass";
import LayerGauge from "./layer-gauge";
import LayerName from "./layer-name";
import MinimapCanvas from "./minimap-canvas";

/** #instr — 좌하단 계기판: 미니맵 · 깊이 게이지 · 레이어 이름 · 축 나침반 */
export default function MinimapPanel() {
  return (
    <aside className="glass absolute bottom-[18px] left-[18px] z-20 flex w-instrument flex-col gap-[11px] px-3.5 pt-[13px] pb-3.5">
      <MinimapCanvas />
      <LayerGauge />
      <LayerName />
      <AxisCompass />
    </aside>
  );
}
