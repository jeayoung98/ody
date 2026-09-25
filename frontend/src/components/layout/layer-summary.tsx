"use client";

import { LAYER_SUMMARIES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 지금 겹이 **무엇으로** 곡을 나눴는지 한 줄 (MAP-06). 겹마다 기준이 달라지는 걸 알아채게 한다.
 *
 * `이 겹을 나눈 기준 —` 이라는 머리말은 걷어냈다 (S15P21A405-477). 문장 자체가 `…로 나눈
 * 레이어` 로 끝나므로 같은 말을 두 번 하는 셈이었다.
 */
export default function LayerSummary() {
  const layer = useMapStore((s) => s.layer);

  return (
    <p // 들여쓰기는 자취 첫 칸의 좌우 여백(px-2)에 맞춘다 — 글머리가 어긋나면 딴 덩어리로 보인다
      // 13px 이었다 (S15P21A405-649). 바로 위 자취가 17px 이라 설명줄만 유난히 작아 안 읽혔다
      className="max-w-[min(34vw,420px)] pl-2 text-[14.5px] leading-[1.4] text-ink-3">
      {LAYER_SUMMARIES[layer]}
    </p>
  );
}
