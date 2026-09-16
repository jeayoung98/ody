"use client";

import type { ReactNode } from "react";

interface TransportButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /**
   * 못 쓰는 것처럼 **보이되 눌리기는 한다** (S15P21A405-336).
   *
   * 눌렀는데 아무 일도 안 나는 게 제일 나쁘다 — 누르면 왜 안 되는지 토스트로 알려 줄 수 있게
   * 클릭은 살려 둔다. 옆의 "내 위치로 가기" 버튼이 쓰는 것과 같은 수법이다.
   */
  dimmed?: boolean;
  primary?: boolean;
  children: ReactNode;
}

/** .tBtn / #tPlay */
export default function TransportButton({ label, onClick, disabled, dimmed, primary, children }: TransportButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={dimmed || undefined}
      className={`grid shrink-0 place-items-center rounded-pill transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-35 ${dimmed ? "opacity-35" : ""} ${
        primary
          ? "h-9 w-9 bg-white/10 text-ink hover:grad-bg hover:text-void"
          : "h-8 w-8 text-ink-2 hover:bg-white/[.08] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
