import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function TextInput({ className = "", ...props }: TextInputProps) {
  return (
    <input
      className={`h-9 w-full rounded-box-sm border border-line bg-white/[.03] px-3 text-sm text-ink placeholder:text-ink-3 focus:border-line-2 focus:outline-none ${className}`}
      {...props}
    />
  );
}
