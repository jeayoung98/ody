"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface NavActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  /** 아이콘 */
  children: ReactNode;
}

/**
 * 우상단 네비의 **동작** 버튼 — 아이콘 옆에 글자를 보인다 (S15P21A405-427).
 * 탭(`RailButton`)은 아이콘만으로 충분하지만, 주변 탐색·여정은 지도 뷰를 바꾸는 동작이라
 * 이름을 읽고 눌러야 한다. 비활성이면 흐려진다 — 그 이유는 `title` 로 말한다.
 */
export default function NavActionButton({ label, active = false, className = "", children, ...props }: NavActionButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-[34px] items-center gap-1.5 rounded-pill px-3 text-[12.5px] whitespace-nowrap transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "grad-bg text-void shadow-glow-azure" : "text-ink-2 hover:bg-white/[.07] hover:text-ink"
      } ${className}`}
      {...props}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
