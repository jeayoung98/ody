import type { ComponentPropsWithRef } from "react";

/**
 * `ComponentPropsWithRef` 라서 **`ref` 를 그대로 받는다** (S15P21A405-540). React 19 에서 `ref` 는
 * 평범한 prop 이지만, 타입이 `ButtonHTMLAttributes` 면 목록에 없어서 넘길 수가 없다.
 * 끌기 손잡이처럼 실제 DOM 을 잡아야 하는 쪽이 필요로 한다. 기존 쓰는 곳에는 영향이 없다 —
 * 받을 수 있는 prop 이 하나 늘었을 뿐이다.
 */
interface IconButtonProps extends ComponentPropsWithRef<"button"> {
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
