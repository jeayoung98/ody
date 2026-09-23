"use client";

import { CatConstellationIcon } from "@/components/common/icons";
import { useContestCurrentQuery } from "@/hooks/queries/use-contest-current-query";
import { roundPhase } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";

/**
 * 우상단 네비 알약 **왼쪽에 따로 서는** 원형 버튼 — 이벤트(별자리 콘테스트, S15P21A405-602 · 640).
 *
 * 프사 버튼(`profile-button.tsx`)과 같은 44px 유리 원이다. 알약 안에 넣지 않는 이유: 네비는
 * 늘 있는 목적지·동작이고 이건 **기간이 있는 이벤트**라, 있다 없다 하는 것이 알약 모양을 흔들면
 * 안 된다. 접수 중이면 초록 점만 붙는다 — D-day·배너는 두지 않는다 (기획 확인, 2026-09-23).
 * 누르면 우측 패널이 아니라 **화면 대부분을 덮는 모달**(`contest/contest-modal.tsx`)이 열린다.
 * 열린 회차가 없으면(`round/current` 가 `null`) 버튼도 없다.
 */
export default function ContestButton() {
  const { data: contest } = useContestCurrentQuery();
  const open = useContestStore((s) => s.open);
  const toggleOpen = useContestStore((s) => s.toggleOpen);
  if (!contest) return null;

  const live = roundPhase(contest) === "OPEN";
  const label = `이벤트 · 별자리 콘테스트 · ${contest.theme}`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={open}
      data-tutorial="contest"
      onClick={toggleOpen}
      className={`glass-liquid relative grid h-11 w-11 place-items-center rounded-pill! transition-colors duration-fast hover:border-line-2 ${
        open ? "border-teal/60! text-ink shadow-glow-azure" : "text-ink-2 hover:text-ink"
      }`}
    >
      <CatConstellationIcon />
      {live && !open && <span aria-hidden className="absolute top-1 right-1 h-2 w-2 rounded-pill bg-online shadow-[0_0_0_2px_#05080f]" />}
    </button>
  );
}
