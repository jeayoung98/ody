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
      // 폰에서는 한 줄이다 (S15P21A405-703). 34vw 는 375px 폰에서 127px 이라 짧은 설명도 두세 줄로 꺾였다.
      // 화면 폭(좌우 여백)까지 풀고 글자를 줄인다. 그래도 넘치는 폰이면 말줄임으로 끝낸다.
      // 폰에서는 들여쓰기도 없앤다 — 자취가 여백에 딱 붙었으므로(`layer-stepper`) 같이 붙어야 한 덩어리다
      className="max-w-[min(34vw,420px)] pl-2 text-[14.5px] leading-[1.4] text-ink-3 max-tablet:max-w-[calc(100dvw-2*var(--spacing-gutter-sm))] max-tablet:pl-0 max-tablet:truncate max-tablet:text-[12.5px] max-tablet:tracking-[-0.01em]">
      {LAYER_SUMMARIES[layer]}
    </p>
  );
}
