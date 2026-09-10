"use client";

import { LAYER_SUMMARIES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/** 지금 겹이 **무엇을 기준으로** 곡을 나눴는지 한 줄 (MAP-06). 겹마다 기준이 달라지는 걸 알아채게 한다 */
export default function LayerSummary() {
  const layer = useMapStore((s) => s.layer);

  return (
    <p className="max-w-[min(34vw,420px)] pl-1 text-[11px] leading-[1.4] text-ink-3">
      이 겹을 나눈 기준 — <b className="font-medium text-ink-2">{LAYER_SUMMARIES[layer]}</b>
    </p>
  );
}
