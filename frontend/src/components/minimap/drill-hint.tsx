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
  const needsZoom = zoomK < DRILL.gateZoomMul;

  const tone = atBottom ? "text-warn" : gateOpen ? "text-teal" : "text-ink-3";

  const message = atBottom
    ? "마지막 레이어. 축소하면 떠오릅니다."
    : gateOpen
      ? `벽에 닿았다 — 계속 확대하면 화면 안 ${inView.toLocaleString()}곡 기준으로 ${LAYER_NAMES[layer + 1]}${ro(LAYER_NAMES[layer + 1])} 파고들어 다시 ${LAYER_SONG_COUNT.toLocaleString()}곡이 깔립니다.`
      : needsZoom
        ? `확대할수록 별이 더 도드라집니다. ${DRILL.gateZoomMul}배까지 확대하면 화면 안 곡을 기준으로 다음 겹으로 갑니다.`
        : `화면 안이 ${inView.toLocaleString()}곡뿐이라 더 들어갈 수 없어요. ${DRILL.minInView}곡 이상 담기게 조금 축소해보세요.`;

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
