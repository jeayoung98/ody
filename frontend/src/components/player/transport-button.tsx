"use client";

import type { ReactNode } from "react";

interface TransportButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: ReactNode;
}

/** .tBtn / #tPlay */
export default function TransportButton({ label, onClick, disabled, primary, children }: TransportButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid shrink-0 place-items-center rounded-pill transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-35 ${
        primary
          ? "h-9 w-9 bg-white/10 text-ink hover:grad-bg hover:text-void"
          : "h-8 w-8 text-ink-2 hover:bg-white/[.08] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
