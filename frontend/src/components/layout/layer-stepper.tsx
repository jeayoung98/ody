"use client";

import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";

/**
 * #crumbs .step — 레이어(PC 단계) 스테퍼. 계층 경로 표시 겸 한 칸 이동 (MAP-07).
 * 아래 칸은 게이트가 열렸을 때만, 위 칸은 되돌아갈 프레임이 있을 때만 활성.
 * 오버레이 뷰(주변 탐색·별자리)가 떠 있는 동안에는 전부 잠긴다 — 임시 뷰라 탐색이 멈춘다 (PATH-01-1).
 */
export default function LayerStepper() {
  const layer = useMapStore((s) => s.layer);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const canRise = useMapStore((s) => s.canRise);
  const holeCount = useMapStore((s) => s.holeCount);
  const morph = useMapStore((s) => s.morph);
  const drillDown = useMapStore((s) => s.drillDown);
  const surface = useMapStore((s) => s.surface);
  const overlayOpen = useMapStore((s) => s.viewMode !== "default");
  const isFollowing = useFollowStore((s) => s.leaderEmail != null);

  return (
    <div className="pointer-events-auto flex max-w-[min(34vw,420px)] flex-wrap items-center gap-1">
      {Array.from({ length: LAYER_COUNT }, (_, i) => {
        const on = i === layer;
        const past = i < layer;
        const next = i === layer + 1;
        const enabled = !isFollowing && !morph && !overlayOpen && ((next && gateOpen) || (i === layer - 1 && canRise));
        const handle = () => (i > layer ? drillDown() : surface());
        return (
          <button
            key={i}
            type="button"
            disabled={!enabled}
            onClick={handle}
            title={
              on
                ? `지금 단계 · ${LAYER_NAMES[i]}`
                : overlayOpen
                  ? "뷰를 닫으면 다시 이동할 수 있어요"
                  : next
                    ? gateOpen
                      ? "한 칸 깊이 — 화면 안 별만 데려가 새 축으로 재투영"
                      : "확대해서 화면 안 곡 수를 게이트 아래로 좁히면 열립니다"
                    : i === layer - 1
                      ? "한 칸 얕게 — 두고 온 별이 돌아오고 좌표도 복원"
                      : "한 칸씩만 이동합니다"
            }
            className={`inline-flex flex-col items-stretch gap-[3px] rounded-[9px] border px-[7px] pt-1 pb-[3px] transition-all duration-fast ${
              on ? "border-line-2 bg-white/[.07]" : next && gateOpen ? "border-teal/30" : "border-transparent"
            } ${!enabled && !on ? "opacity-40" : "hover:border-line hover:bg-white/[.06]"} disabled:cursor-default`}
          >
            <span
              className={`flex items-baseline gap-1 text-[11.5px] leading-none ${
                on ? "font-semibold text-ink" : past ? "text-ink-3" : next && gateOpen ? "text-teal" : "text-ink-4"
              }`}
            >
              {LAYER_NAMES[i]}
              <em className="num text-[8px] tracking-[0.02em] opacity-55 not-italic">L{i}</em>
            </span>
            <span className={`h-[3px] w-full rounded-pill ${on ? "grad-bg" : past ? "bg-teal/50" : "bg-white/[.13]"}`} />
            {next && <span className="num text-[8.5px] text-teal">{gateOpen ? holeCount : ""}</span>}
          </button>
        );
      })}
    </div>
  );
}
