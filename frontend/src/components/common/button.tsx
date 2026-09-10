import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** 활성(토글 on) 상태 표시 */
  active?: boolean;
}

/** 프로토타입 .btn / .btn.pri / .btn.danger / .btn.sm */
const VARIANT_CLASS: Record<Variant, string> = {
  primary: "grad-bg text-text-on-primary font-semibold border-transparent hover:brightness-110",
  secondary: "bg-glass text-ink border-line hover:bg-glass-2 hover:border-line-2",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-glass-2 hover:text-ink",
  danger: "bg-transparent text-bad border-bad/30 hover:bg-bad/10",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-[11px] py-[7px] text-xs rounded-box-xs",
  md: "px-3.5 py-2.5 text-sm rounded-box-sm",
};

export default function Button({
  variant = "secondary",
  size = "md",
  active = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-[7px] border transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${
        active ? "border-violet/50 text-white shadow-glow-violet" : ""
      } ${className}`}
      {...props}
    />
  );
}
