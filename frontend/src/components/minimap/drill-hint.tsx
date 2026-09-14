"use client";

import { DRILL, LAYER_NAMES, LAYER_SONG_COUNT } from "@/constants";
import { ro } from "@/lib/korean";
import { useMapStore } from "@/stores/use-map-store";

/**
 * 파고들기 안내 (MAP-04). 한 레이어 안에서 자유롭게 확대·축소하다가,
 * 진입 배율의 DRILL.gateZoomMul 배를 넘겨 확대했을 때부터 게이트가 열린다.
 */
export default function DrillHint() {
  const layer = useMapStore((s) => s.layer);
  const zoomK = useMapStore((s) => s.zoomK);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const atBottom = useMapStore((s) => s.atBottom);
  const inView = useMapStore((s) => s.viewportCount);

  const tone = atBottom ? "text-warn" : gateOpen ? "text-teal" : "text-ink-3";

  // 화면 안이 비어 있어도 파고들 수 있다 — 가장 가까운 별을 가운데 두고 범위를 넓혀 보낸다
  const sparse = inView < DRILL.minInView;
  const message = atBottom
    ? "마지막 레이어. 축소하면 떠오릅니다."
    : gateOpen
      ? sparse
        ? `벽에 닿았다 — 계속 확대하면 가장 가까운 별을 가운데 두고 ${LAYER_NAMES[layer + 1]}${ro(LAYER_NAMES[layer + 1])} 파고들어 다시 ${LAYER_SONG_COUNT.toLocaleString()}곡이 깔립니다.`
        : `벽에 닿았다 — 계속 확대하면 화면 안 ${inView.toLocaleString()}곡 기준으로 ${LAYER_NAMES[layer + 1]}${ro(LAYER_NAMES[layer + 1])} 파고들어 다시 ${LAYER_SONG_COUNT.toLocaleString()}곡이 깔립니다.`
      : `확대할수록 별이 더 도드라집니다. ${DRILL.gateZoomMul}배까지 확대하면 화면 안 곡을 기준으로 다음 겹으로 갑니다.`;

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
