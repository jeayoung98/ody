"use client";

import type { ReactNode } from "react";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  /** 튜토리얼이 이 버튼을 밝힐 때 찾는 이름 (S15P21A405-347) */
  "data-tutorial"?: string;
}

/** .railBtn — 활성 시 그라데이션 원. 34px 는 우상단 알약(38px)에 맞춘 값이다 (S15P21A405-427) */
export default function RailButton({ label, active, onClick, children, badge, "data-tutorial": dataTutorial }: RailButtonProps) {
  return (
    <button
      type="button"
      title={label}
      data-tutorial={dataTutorial}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative grid h-[34px] w-[34px] place-items-center rounded-pill transition-all duration-fast ${
        active ? "grad-bg text-void shadow-glow-azure" : "text-ink-3 hover:bg-white/[.07] hover:text-ink"
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className={`num absolute top-0.5 right-0.5 grid h-[15px] min-w-[15px] place-items-center rounded-pill px-1 text-[9px] font-semibold ${
            active ? "bg-void text-teal" : "bg-teal text-[#04211d] shadow-[0_0_0_2px_#070b16]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
