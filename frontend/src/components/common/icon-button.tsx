import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 접근성용 라벨 (필수) */
  label: string;
  active?: boolean;
  /** px. 기본 28 (.xBtn) */
  size?: number;
  /** 글래스 배경 원형 (HUD 상단 버튼용) */
  glass?: boolean;
}

/** 아이콘/이모지 하나만 들어가는 원형 버튼 (.xBtn / .iconBtn / #dockBtn) */
export default function IconButton({ label, active = false, size = 28, glass = false, className = "", children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-pill text-ink-3 transition-colors duration-fast hover:bg-glass-3 hover:text-ink ${
        glass ? "glass rounded-pill! text-ink-2" : ""
      } ${active ? "text-teal" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
