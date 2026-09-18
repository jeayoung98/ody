"use client";

import type { ReactNode } from "react";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  /** 못 누르는 상태. 흐려지고 호버도 죽는다 — 이유는 `title` 로 말한다 */
  disabled?: boolean;
  /** 툴팁 문구. 없으면 `label` */
  title?: string;
  /**
   * 아이콘 아래 이름을 작게 쓴다 — 탭 알약용. 원도 40px 로 커진다.
   * 동작 알약(주변 탐색·여정)은 아이콘만 쓴다 (34px).
   */
  caption?: boolean;
  /** 튜토리얼이 이 버튼을 밝힐 때 찾는 이름 (S15P21A405-347) */
  "data-tutorial"?: string;
}

/** .railBtn — 활성 시 그라데이션 원. 34px 는 우상단 알약(38px)에 맞춘 값이다 (S15P21A405-427) */
export default function RailButton({ label, active, onClick, children, badge, disabled = false, title, caption = false, "data-tutorial": dataTutorial }: RailButtonProps) {
  const circle = `relative grid place-items-center rounded-pill transition-all duration-fast ${caption ? "h-10 w-10" : "h-[34px] w-[34px]"} ${
    active ? "grad-bg text-void shadow-glow-azure" : disabled ? "text-ink-3" : "text-ink-3 group-hover:bg-white/[.07] group-hover:text-ink"
  }`;
  const badgeEl = badge != null && badge > 0 && (
    <span
      className={`num absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-pill px-1 text-[9px] font-semibold ${
        active ? "bg-void text-teal" : "bg-teal text-[#04211d] shadow-[0_0_0_2px_#070b16]"
      }`}
    >
      {badge}
    </span>
  );

  return (
    <button
      type="button"
      title={title ?? label}
      data-tutorial={dataTutorial}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`group flex flex-col items-center rounded-pill disabled:cursor-not-allowed disabled:opacity-40 ${caption ? "gap-[3px] px-1 pt-1 pb-1.5" : ""}`}
    >
      <span className={circle}>
        {children}
        {badgeEl}
      </span>
      {caption && <span className={`text-[9px] leading-none tracking-[0.02em] ${active ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}`}>{label}</span>}
    </button>
  );
}
