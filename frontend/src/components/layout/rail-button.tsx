"use client";

import type { ReactNode } from "react";

interface RailButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number;
}

/** .railBtn — 활성 시 그라데이션 원 */
export default function RailButton({ label, active, onClick, children, badge }: RailButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative grid h-10 w-10 place-items-center rounded-pill transition-all duration-fast ${
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
