import Link from "next/link";
import AuthCard from "@/components/auth/auth-card";
import { GuestGate } from "@/components/auth/auth-guard";
import EmailLoginForm from "@/components/auth/email-login-form";
import GoogleLoginButton from "@/components/auth/google-login-button";
import { ROUTES } from "@/constants";

/** 로그인 (AUTH-02) — 이메일·비밀번호 또는 구글 소셜 로그인 */
export default function LoginPage() {
  return (
    <GuestGate>
      {/*
        **설명 문구를 걷었다** (S15P21A405-655). 제목 아래 부제와 카드 맨 아래 두 줄
        (이용약관 동의 고지 · 프로토타입 안내)을 뺀다 — 로그인하러 온 사람이 읽을 일이 없고,
        카드만 길어져서 이메일 칸과 버튼으로 가는 시선을 흐렸다.

        동의 고지를 뺀 것은 기획 판단이다. 되살려야 하면 여기에 다시 넣는다.
      */}
      <AuthCard title="다시 만나서 반가워요">
        <EmailLoginForm />

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="lbl">또는</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <GoogleLoginButton />

        {/* 아래 두 줄(동의 고지·프로토타입 안내)을 빼면서 이 줄이 카드의 마지막이 됐다 */}
        <p className="mt-6 border-t border-line pt-5 text-center text-[14px] text-ink-2">
          계정이 없으신가요?{" "}
          <Link href={ROUTES.signup} className="font-semibold text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">
            ODY 가입하기
          </Link>
        </p>
      </AuthCard>
    </GuestGate>
  );
}
