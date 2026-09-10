"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROUTES } from "@/constants";
import { useSignupMutation } from "@/hooks/mutations/use-email-auth-mutation";
import { emailError, passwordError, PASSWORD_MIN } from "@/lib/auth-rules";
import type { ApiError } from "@/lib/api";
import AuthField from "./auth-field";

/** 이메일·비밀번호 가입 (AUTH-01). 닉네임은 가입 직후 다음 화면에서 받는다 */
export default function SignupForm() {
  const router = useRouter();
  const signup = useSignupMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const confirmError = (v: string) => (v === password ? null : "비밀번호가 서로 달라요.");
  const eErr = touched ? emailError(email) : null;
  const pErr = touched ? passwordError(password) : null;
  const cErr = touched ? confirmError(confirm) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailError(email) || passwordError(password) || confirmError(confirm)) return;
    // 가입 직후에는 닉네임이 비어 있다 — 닉네임 화면으로 보낸다 (AUTH-01)
    signup.mutate({ email, password }, { onSuccess: () => router.replace(ROUTES.nickname) });
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
          autoComplete="new-password"
          placeholder="••••••••"
          value={password}
          error={pErr}
          hint={`${PASSWORD_MIN}자 이상`}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button type="button" onClick={() => setShow((v) => !v)} className="shrink-0 text-[11px] text-ink-3 transition-colors hover:text-ink">
              {show ? "숨기기" : "표시"}
            </button>
          }
        />
        <AuthField
          label="비밀번호 확인"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          error={cErr}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {signup.isError && <p className="mt-3 text-[11.5px] text-bad">{(signup.error as ApiError).message}</p>}

      <button
        type="submit"
        disabled={signup.isPending}
        className="grad-bg mt-5 w-full rounded-pill py-3 text-[13.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {signup.isPending ? "가입 중…" : "가입하기"}
      </button>
    </form>
  );
}
