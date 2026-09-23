"use client";

import { useState } from "react";
import { ConstellationIcon } from "@/components/common/icons";
import { useContestCurrentQuery } from "@/hooks/queries/use-contest-current-query";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 우상단 네비 알약 **왼쪽에 따로 서는** 원형 버튼 — 별자리 콘테스트 (S15P21A405-602).
 *
 * 프사 버튼(`profile-button.tsx`)과 같은 44px 유리 원이다. 알약 안에 넣지 않는 이유: 네비는
 * 늘 있는 목적지·동작이고 이건 **기간이 있는 이벤트**라, 있다 없다 하는 것이 알약 모양을 흔들면
 * 안 된다. 진행 중이면 초록 점과 D-day 라벨이 붙는다 — 별도 배너는 두지 않는다.
 * 진행 중인 회차가 없으면 버튼도 없다.
 */
export default function ContestButton() {
  const { data: contest } = useContestCurrentQuery();
  const active = usePanelStore((s) => s.activePanel) === "contest";
  const toggle = usePanelStore((s) => s.toggle);
  // 렌더 중 `Date.now()` 는 순수하지 않다(react-hooks/purity) — 마운트 시각 하나로 고정한다. D-day 는 하루 단위라 충분하다
  const [now] = useState(() => Date.now());
  if (!contest) return null;

  const open = contest.status === "OPEN";
  const dday = Math.ceil((new Date(contest.endsAt).getTime() - now) / 86_400_000);
  const label = `별자리 콘테스트 · ${contest.theme}${open ? ` · D-${Math.max(0, dday)}` : ""}`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-tutorial="contest"
      onClick={() => toggle("contest")}
      className={`glass-liquid relative grid h-11 w-11 place-items-center rounded-pill! transition-colors duration-fast hover:border-line-2 ${
        active ? "border-teal/60! text-ink shadow-glow-azure" : "text-ink-2 hover:text-ink"
      }`}
    >
      <ConstellationIcon />
      {open && !active && <span aria-hidden className="absolute top-1 right-1 h-2 w-2 rounded-pill bg-online shadow-[0_0_0_2px_#05080f]" />}
      {open && dday >= 0 && (
        <span aria-hidden className="num absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-pill bg-teal px-1.5 text-[9px] leading-[14px] font-semibold text-[#04211d] shadow-[0_0_0_2px_#05080f]">
          D-{dday}
        </span>
      )}
    </button>
  );
}
