"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROUTES } from "@/constants";
import { useLoginMutation } from "@/hooks/mutations/use-email-auth-mutation";
import { emailError, loginPasswordError } from "@/lib/auth-rules";
import type { ApiError } from "@/lib/api";
import AuthField from "./auth-field";

/** 이메일·비밀번호 로그인 (AUTH-02) */
export default function EmailLoginForm() {
  const router = useRouter();
  const login = useLoginMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [forgotNote, setForgotNote] = useState(false);

  const eErr = touched ? emailError(email) : null;
  const pErr = touched ? loginPasswordError(password) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailError(email) || loginPasswordError(password)) return;
    login.mutate({ email, password, remember }, { onSuccess: () => router.replace(ROUTES.home) });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-col gap-3.5">
        <AuthField
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          error={eErr}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="비밀번호"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          error={pErr}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button type="button" onClick={() => setShow((v) => !v)} className="shrink-0 text-[13px] text-ink-3 transition-colors hover:text-ink">
              {show ? "숨기기" : "표시"}
            </button>
          }
        />
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-teal" />
          로그인 상태 유지
        </label>
        <button type="button" onClick={() => setForgotNote(true)} className="text-[13.5px] text-teal underline decoration-teal/40 underline-offset-2">
          비밀번호를 잊으셨나요?
        </button>
      </div>
      {forgotNote && <p className="mt-2 text-[13px] text-ink-3">비밀번호 찾기는 아직 준비 중이에요.</p>}

      {login.isError && <p className="mt-3 text-[13.5px] text-bad">{(login.error as ApiError).message}</p>}

      <button
        type="submit"
        disabled={login.isPending}
        className="grad-bg mt-5 w-full rounded-pill py-3 text-[15.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {login.isPending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
