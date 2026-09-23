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
      <AuthCard
        title="다시 만나서 반가워요"
        sub={
          <>
            로그인하면 <b className="font-semibold text-ink">내 좌표</b>와 저장한 <b className="font-semibold text-ink">여정</b>이 그대로 이어집니다.
          </>
        }
      >
        <EmailLoginForm />

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="lbl">또는</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <GoogleLoginButton />

        <p className="mt-6 border-t border-line pt-5 text-center text-[13px] text-ink-2">
          계정이 없으신가요?{" "}
          <Link href={ROUTES.signup} className="font-semibold text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">
            ODY 가입하기
          </Link>
        </p>
        <p className="mt-3 text-center text-[12px] leading-[1.7] text-ink-4">
          로그인하면 이용약관과 개인정보 처리방침에 동의하는 것으로 간주됩니다.
          <br />
          SSAFY 특화 프로젝트 프로토타입 · 실제 음원 재생은 지원하지 않습니다.
        </p>
      </AuthCard>
    </GuestGate>
  );
}
