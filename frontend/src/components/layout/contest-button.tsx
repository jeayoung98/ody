"use client";

import { CatConstellationIcon } from "@/components/common/icons";
import { RIDING_CONTEST_BLOCKED } from "@/constants";
import { useContestCurrentQuery } from "@/hooks/queries/use-contest-current-query";
import { roundPhase } from "@/lib/contest-view";
import { useContestStore } from "@/stores/use-contest-store";
import { useFollowStore } from "@/stores/use-follow-store";

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
  /**
   * **따라가는 동안에는 잠근다** (S15P21A405-660). 이벤트는 화면 대부분을 덮는 모달이라
   * 여는 순간 선단이 안 보이고, 그 안에서 그리기·출품을 하는 사이 인솔자가 어디로 갔는지
   * 모르게 된다. 지도 조작을 잠그는 것(605)과 결은 같지만 이유가 달라 문구도 따로 둔다.
   */
  const riding = useFollowStore((s) => s.leaderEmail != null);
  if (!contest) return null;

  const live = roundPhase(contest) === "OPEN";
  const label = `이벤트 · 별자리 콘테스트 · ${contest.theme}`;

  return (
    <button
      type="button"
      title={riding ? RIDING_CONTEST_BLOCKED : label}
      aria-label={label}
      aria-pressed={open}
      disabled={riding}
      data-tutorial="contest"
      onClick={toggleOpen}
      className={`glass-liquid relative grid h-11 w-11 place-items-center rounded-pill! transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
        open ? "border-teal/60! text-ink shadow-glow-azure" : riding ? "text-ink-3" : "text-ink-2 hover:border-line-2 hover:text-ink"
      }`}
    >
      <CatConstellationIcon />
      {live && !open && <span aria-hidden className="absolute top-1 right-1 h-2 w-2 rounded-pill bg-online shadow-[0_0_0_2px_#05080f]" />}
    </button>
  );
}
