"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** 입력 아래 문구. error 가 있으면 붉게 */
  hint?: ReactNode;
  error?: string | null;
  /** 입력창 오른쪽에 붙는 것 (비밀번호 표시 토글 등) */
  trailing?: ReactNode;
}

/** 가입·로그인 입력 한 칸 */
export default function AuthField({ label, hint, error, trailing, ...input }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">{label}</span>
      <span
        className={`flex items-center gap-2 rounded-[13px] border bg-white/[.03] px-3.5 py-3 transition-colors focus-within:bg-white/[.05] ${
          error ? "border-bad/60" : "border-line focus-within:border-teal/60"
        }`}
      >
        <input className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-4" autoComplete="off" spellCheck={false} {...input} />
        {trailing}
      </span>
      {(error || hint) && <span className={`mt-1.5 block text-[12px] leading-[1.5] ${error ? "text-bad" : "text-ink-3"}`}>{error ?? hint}</span>}
    </label>
  );
}
