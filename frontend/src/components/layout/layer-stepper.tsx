"use client";

import { LAYER_COUNT, LAYER_NAMES } from "@/constants";
import { useFollowStore } from "@/stores/use-follow-store";
import { brightConstellationIds, useMapStore } from "@/stores/use-map-store";

/**
 * #crumbs .step — 레이어(PC 단계) 스테퍼. 계층 경로 표시 겸 한 칸 이동 (MAP-07).
 * 평소: 아래 칸은 게이트가 열렸을 때만, 위 칸은 되돌아갈 프레임이 있을 때만 활성.
 * 별자리가 보이는 동안: 모든 칸 활성 — 보기 전용 전환으로 별자리 모양이 바뀌는 걸 바로 본다 (PATH-01).
 */
export default function LayerStepper() {
  const layer = useMapStore((s) => s.layer);
  const gateOpen = useMapStore((s) => s.gateOpen);
  const canRise = useMapStore((s) => s.canRise);
  const holeCount = useMapStore((s) => s.holeCount);
  const morph = useMapStore((s) => s.morph);
  const drillDown = useMapStore((s) => s.drillDown);
  const surface = useMapStore((s) => s.surface);
  const jumpLayer = useMapStore((s) => s.jumpLayer);
  const freeJump = useMapStore((s) => brightConstellationIds(s).length >= 2 && s.constellationVisible);
  const isFollowing = useFollowStore((s) => s.leaderEmail != null);

  return (
    <div className="pointer-events-auto flex max-w-[min(34vw,420px)] flex-wrap items-center gap-1">
      {Array.from({ length: LAYER_COUNT }, (_, i) => {
        const on = i === layer;
        const past = i < layer;
        const next = i === layer + 1;
        const enabled = !isFollowing && !morph && (freeJump ? !on : (next && gateOpen) || (i === layer - 1 && canRise));
        const handle = () => {
          if (freeJump) jumpLayer(i);
          else if (i > layer) drillDown();
          else surface();
        };
        return (
          <button
            key={i}
            type="button"
            disabled={!enabled}
            onClick={handle}
            title={
              on
                ? `지금 단계 · ${LAYER_NAMES[i]}`
                : freeJump
                  ? `${LAYER_NAMES[i]} 축으로 별자리 보기`
                  : next
                    ? gateOpen
                      ? "한 칸 깊이 — 화면 안 별만 데려가 새 축으로 재투영"
                      : "확대해서 화면 안 곡 수를 게이트 아래로 좁히면 열립니다"
                    : i === layer - 1
                      ? "한 칸 얕게 — 두고 온 별이 돌아오고 좌표도 복원"
                      : "한 칸씩만 이동합니다"
            }
            className={`inline-flex flex-col items-stretch gap-[3px] rounded-[9px] border px-[7px] pt-1 pb-[3px] transition-all duration-fast ${
              on ? "border-line-2 bg-white/[.07]" : freeJump ? "border-violet/25" : next && gateOpen ? "border-teal/30" : "border-transparent"
            } ${!enabled && !on ? "opacity-40" : "hover:border-line hover:bg-white/[.06]"} disabled:cursor-default`}
          >
            <span
              className={`flex items-baseline gap-1 text-[11.5px] leading-none ${
                on ? "font-semibold text-ink" : freeJump ? "text-violet" : past ? "text-ink-3" : next && gateOpen ? "text-teal" : "text-ink-4"
              }`}
            >
              {LAYER_NAMES[i]}
              <em className="num text-[8px] tracking-[0.02em] opacity-55 not-italic">L{i}</em>
            </span>
            <span className={`h-[3px] w-full rounded-pill ${on ? "grad-bg" : past ? "bg-teal/50" : "bg-white/[.13]"}`} />
            {!freeJump && next && <span className="num text-[8.5px] text-teal">{gateOpen ? holeCount : ""}</span>}
          </button>
        );
      })}
      {freeJump && <span className="num basis-full pl-2 text-[10px] tracking-[0.03em] text-violet">별자리 보는 중 · 어느 레이어든 눌러 모양 비교</span>}
    </div>
  );
}
