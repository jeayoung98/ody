"use client";

import { useEffect, useState } from "react";
import type { Occlusion } from "@/components/map/engine/map-engine";
import { LAYER_AXES } from "@/constants";
import { useMapStore } from "@/stores/use-map-store";
import { getMapEngine } from "./engine/engine-registry";

/** 움직임이 멎고 이만큼 지나면 다시 연해진다 */
const CALM_MS = 1500;
/** 카메라를 들여다보는 주기. 이보다 촘촘할 이유가 없다 — 눈에 보이는 건 밝기뿐이다 */
const TICK_MS = 160;

/**
 * 지도 네 가장자리의 축 라벨 (S15P21A405-358).
 *
 * 축을 알 방법이 겹 전환 자막과 좌하단 나침반뿐이었다. 앞은 전환이 끝나면 사라지고 뒤는
 * 구석에 있고 접히는 데다, 둘 다 축을 **문장이나 도식으로 설명할 뿐** 화면의 실제 방향과
 * 이어지지 않는다. 오른쪽 가장자리에 "밝고 거친" 이 적혀 있으면 오른쪽으로 끄는 일이 곧
 * 그쪽으로 가는 일이 된다.
 *
 * **평소엔 연하게, 움직이면 또렷하게.** 늘 진하면 곡 제목과 시야를 다투고, 전환할 때만
 * 뜨면 오 분 뒤에 "어느 쪽이 밝은 거였지" 하면 답이 없다. 밝기를 두 단계로 두면 둘 다 된다.
 *
 * 움직임은 **카메라를 들여다봐서** 안다. 휠·드래그 이벤트를 듣는 것보다 확실하다 — 내 위치로
 * 가기나 겹 전환처럼 코드가 옮기는 경우까지 같은 잣대로 잡힌다.
 */
export default function MapAxisLabels({ occlusion }: { occlusion: Occlusion }) {
  const layer = useMapStore((s) => s.layer);
  const [awake, setAwake] = useState(false);

  useEffect(() => {
    let last = "";
    let calmAt = 0;
    const id = window.setInterval(() => {
      const c = getMapEngine()?.cam;
      if (!c) return;
      const now = `${c.s.toFixed(4)}|${c.cx.toFixed(2)}|${c.cy.toFixed(2)}`;
      if (now !== last) {
        last = now;
        calmAt = Date.now() + CALM_MS;
        setAwake(true);
      } else if (calmAt && Date.now() > calmAt) {
        calmAt = 0;
        setAwake(false);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const ax = LAYER_AXES[layer];
  // 뜻이 없는 축(PC4 · PC12)은 이름을 지어내지 않는다 — 나침반이 쓰는 말과 같게 적는다
  const x = ax.x[0] ? ax.x : (["미세한 차이", "미세한 차이"] as const);
  const y = ax.y[0] ? ax.y : (["미세한 차이", "미세한 차이"] as const);

  const cl = `pointer-events-none absolute z-[19] max-w-[26vw] truncate text-[13px] tracking-[0.02em] transition-[opacity,color] duration-500 ${
    awake ? "text-ink-2 opacity-90" : "text-ink-4 opacity-30"
  }`;
  return (
    <>
      <span className={`${cl} top-1/2 left-[18px] -translate-y-1/2`}>◀ {x[0]}</span>
      {/* 우측 패널이 열리면 그만큼 안쪽으로 — 패널 뒤에 숨으면 적어 둔 보람이 없다 */}
      <span className={`${cl} top-1/2 -translate-y-1/2 text-right`} style={{ right: occlusion.right + 18 }}>
        {x[1]} ▶
      </span>
      {/* 위아래는 검색창·플레이어바를 피해 안쪽으로 물린다 */}
      <span className={`${cl} top-[72px] left-1/2 -translate-x-1/2 text-center`}>▲ {y[1]}</span>
      <span className={`${cl} bottom-[84px] left-1/2 -translate-x-1/2 text-center`}>{y[0]} ▼</span>
    </>
  );
}
