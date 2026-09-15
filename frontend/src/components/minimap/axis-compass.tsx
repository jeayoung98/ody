"use client";

import { LAYER_AXES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * #compass — 현재 레이어의 두 축 라벨 (MAP-06).
 * 라벨의 기준 문서는 [docs/rules/PC-AXES.md](../../../../docs/rules/PC-AXES.md) 다.
 *
 * 해석 가능한 특징과 대응이 없는 축(PC4 · PC12)은 라벨이 비어 있다. 그때는 화살표만 두고
 * 가운데에 왜 비었는지 적는다 — 빈 화살표만 있으면 로딩이 덜 된 것처럼 읽힌다.
 */
export default function AxisCompass() {
  const layer = useMapStore((s) => s.layer);
  const ax = LAYER_AXES[layer];
  const faintX = !ax.x[0];
  const faintY = !ax.y[0];
  const cl = "absolute text-[9.5px] leading-[1.3] text-ink-2 [&_b]:font-medium [&_b]:text-ink";
  return (
    <div className="relative mt-px h-[106px] rounded-[10px] border border-white/[.055] bg-gradient-to-b from-white/[.02] to-transparent">
      <span className="absolute top-1/2 right-[10%] left-[10%] h-px bg-white/[.11]" />
      <span className="absolute top-[12%] bottom-[12%] left-1/2 w-px bg-white/[.11]" />
      <span className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-teal shadow-[0_0_12px_#4fe3ce]" />
      {/* 라벨이 없는 축은 "이 방향은 설명이 안 된다"를 가운데에 적는다 */}
      {(faintX || faintY) && (
        <span className="absolute bottom-[26px] left-1/2 -translate-x-1/2 text-[8.5px] text-ink-4">
          {faintX && faintY ? "두 축 모두" : faintX ? "가로" : "세로"} 미세한 차이
        </span>
      )}
      <span className={`${cl} top-[7px] left-1/2 max-w-[74%] -translate-x-1/2 text-center`}>
        <b>▲</b> {ax.y[1]}
      </span>
      <span className={`${cl} bottom-[7px] left-1/2 max-w-[74%] -translate-x-1/2 text-center`}>
        {ax.y[0]} <b>▼</b>
      </span>
      <span className={`${cl} top-1/2 left-[9px] max-w-[40%] -translate-y-1/2 text-left`}>
        <b>◀</b> {ax.x[0]}
      </span>
      <span className={`${cl} top-1/2 right-[9px] max-w-[40%] -translate-y-1/2 text-right`}>
        {ax.x[1]} <b>▶</b>
      </span>
    </div>
  );
}
