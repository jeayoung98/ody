"use client";

import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";

/**
 * #gauge .rung — 깊이 게이지.
 *
 * **여덟 칸이 그라데이션 하나를 나눠 갖는다** (S15P21A405-479). 예전에는 칸마다 `grad-bg` 를
 * 통째로 칠해서, 칸 하나하나가 청록→보라를 처음부터 끝까지 반복했다 — 여덟 개의 작은
 * 그라데이션이지 한 줄기가 아니었다. 지금은 게이지 전체 폭만큼 늘린 가로 그라데이션을
 * 깔고 칸마다 제 구간만 내보인다. 첫 칸은 늘 청록, 마지막 칸은 늘 보라다.
 *
 * `background-size` 가 칸 폭의 여덟 배라서, `background-position-x` 를 0%→100% 로 고르게
 * 옮기면 그 여덟 배 안에서 i 번째 구간이 잡힌다. 칸 사이 2px 틈은 계산에서 뺐다 — 틈까지
 * 반영하려면 픽셀 폭을 알아야 하는데, 눈으로는 차이가 잡히지 않는다.
 *
 * **밟은 칸은 흐려지지 않는다.** 지난 칸을 35% 로 눌러 두면 옅은 청록 옆에 진한 파랑이 와서
 * 한 줄기로 안 읽힌다. 지금 칸은 밝기 대신 **발광**으로 가른다.
 */
export default function LayerGauge() {
  const layer = useMapStore((s) => s.layer);
  return (
    <div className="flex h-[26px] items-end gap-0.5" aria-label="레이어 깊이">
      {Array.from({ length: LAYER_COUNT }, (_, i) => (
        <span
          key={i}
          title={`L${i} ${LAYER_NAMES[i]}`}
          className="relative min-w-0.5 flex-1 rounded-[2px] bg-white/[.07] transition-all duration-normal"
          style={{ height: `${26 + i * (74 / (LAYER_COUNT - 1))}%` }}
        >
          <span
            className={`grad-bg-h absolute inset-0 -bottom-px rounded-[2px] transition-opacity duration-normal ${
              i <= layer ? "opacity-100" : "opacity-0"
            } ${i === layer ? "shadow-[0_0_16px_-3px_rgba(92,157,255,.9)]" : ""}`}
            style={{ backgroundSize: `${LAYER_COUNT * 100}% 100%`, backgroundPositionX: `${(i / (LAYER_COUNT - 1)) * 100}%` }}
          />
        </span>
      ))}
    </div>
  );
}
