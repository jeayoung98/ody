"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ROUTES } from "@/constants";
import { useSignupMutation } from "@/hooks/mutations/use-email-auth-mutation";
import { emailError, nicknameError, passwordError } from "@/lib/auth-rules";
import type { ApiError } from "@/lib/api";
import AuthField from "./auth-field";
import NicknameCheckField from "./nickname-check-field";

/**
 * 이메일·비밀번호 가입 (AUTH-01).
 * 백엔드가 가입 요청에서 닉네임까지 함께 받으므로 한 화면에서 다 받는다 (S15P21A405-121).
 */
export default function SignupForm() {
  const router = useRouter();
  const signup = useSignupMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameOk, setNicknameOk] = useState(false);
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const confirmError = (v: string) => (v === password ? null : "비밀번호가 서로 달라요.");
  const eErr = touched ? emailError(email) : null;
  const pErr = touched ? passwordError(password) : null;
  const cErr = touched ? confirmError(confirm) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailError(email) || passwordError(password) || confirmError(confirm) || nicknameError(nickname)) return;
    signup.mutate({ email, password, nickname }, { onSuccess: () => router.replace(ROUTES.home) });
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
          hint="영문과 숫자를 포함해 8자 이상"
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
        <NicknameCheckField value={nickname} onChange={setNickname} onStatus={useCallback((ok: boolean) => setNicknameOk(ok), [])} />
      </div>

      {signup.isError && <p className="mt-3 text-[11.5px] text-bad">{(signup.error as ApiError).message}</p>}

      <button
        type="submit"
        disabled={signup.isPending || !nicknameOk}
        className="grad-bg mt-5 w-full rounded-pill py-3 text-[13.5px] font-semibold text-[#031018] shadow-[0_8px_28px_-12px_rgba(92,157,255,.9)] transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {signup.isPending ? "가입 중…" : "가입하기"}
      </button>
    </form>
  );
}
