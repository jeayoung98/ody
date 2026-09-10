import Link from "next/link";
import AuthCard from "@/components/auth/auth-card";
import { GuestGate } from "@/components/auth/auth-guard";
import GoogleLoginButton from "@/components/auth/google-login-button";
import SignupForm from "@/components/auth/signup-form";
import { ROUTES } from "@/constants";

/** 회원가입 (AUTH-01) — 이메일·비밀번호 또는 구글. 닉네임은 다음 화면에서 받는다 */
export default function SignupPage() {
  return (
    <GuestGate>
      <AuthCard title="ODY 가입하기" sub="가입하고 나면 닉네임을 정하고, 첫 좌표를 찍으러 갑니다.">
        <SignupForm />

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="lbl">또는</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <GoogleLoginButton />

        <p className="mt-6 border-t border-line pt-5 text-center text-[12px] text-ink-2">
          이미 계정이 있으신가요?{" "}
          <Link href={ROUTES.login} className="font-semibold text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">
            로그인
          </Link>
        </p>
      </AuthCard>
    </GuestGate>
  );
}
