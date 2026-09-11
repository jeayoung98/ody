"use client";

import { DRILL, LAYER_NAMES } from "@/constants";
import { ro } from "@/lib/korean";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 파고들기 안내 (MAP-04). 한 레이어 안에서 자유롭게 확대·축소하다가,
 * 진입 배율의 DRILL.gateZoomMul 배를 넘겨 확대했을 때부터 게이트가 열린다.
 */
export default function DrillHint() {
  const layer = useMapStore((s) => s.layer);
  const holeCount = useMapStore((s) => s.holeCount);
  const zoomK = useMapStore((s) => s.zoomK);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const atBottom = useMapStore((s) => s.atBottom);

  const needsZoom = zoomK < DRILL.gateZoomMul;
  // 너무 확대해 구멍 안 곡이 minKeep 아래로 떨어지면 데려갈 곡이 없어 못 내려간다
  const tooDeep = !needsZoom && holeCount < DRILL.minKeep;
  const tone = atBottom ? "text-warn" : gateOpen ? "text-teal" : tooDeep ? "text-warn" : "text-ink-3";

  const message = atBottom
    ? "마지막 레이어. 축소하면 떠오릅니다."
    : gateOpen
      ? `벽에 닿았다 — 계속 확대하면 이 ${holeCount.toLocaleString()}곡을 들고 ${LAYER_NAMES[layer + 1]}${ro(LAYER_NAMES[layer + 1])} 파고듭니다.`
      : needsZoom
        ? `이 겹 안에서 자유롭게 확대할 수 있어요. ${DRILL.gateZoomMul}배까지 확대하면 다음 겹으로 파고들 수 있습니다.`
        : tooDeep
          ? `너무 확대했어요 — 화면 안에 ${DRILL.minKeep}곡은 있어야 데려갈 수 있습니다. 조금 축소해보세요.`
          : `조금 더 확대해 화면 안을 ${DRILL.gate.toLocaleString()}곡 아래로 좁히면 파고들 수 있어요.`;

  return (
    <>
      {!atBottom && (
        <div className="mt-[5px] h-[3px] overflow-hidden rounded-pill bg-white/[.07]">
          <div
            className={`h-full rounded-pill transition-[width] duration-fast ${gateOpen ? "bg-teal" : "bg-azure/70"}`}
            style={{ width: `${Math.min(100, (zoomK / DRILL.gateZoomMul) * 100).toFixed(1)}%` }}
          />
        </div>
      )}
      <p className={`mt-1.5 text-[11px] leading-[1.45] ${tone}`}>{message}</p>
    </>
  );
}
