import GoogleLoginButton from "@/components/auth/google-login-button";

/** 회원가입/로그인: 구글 소셜 로그인만 (닉네임, 프로필 사진을 받는다) */
export default function LoginPage() {
  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center p-6">
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="glass animate-tin relative w-full max-w-sm rounded-[16px]! px-6 pt-7 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="grad-bg relative h-[26px] w-[26px] rounded-[8px] shadow-[0_0_22px_-4px_rgba(92,157,255,.75)]" />
          <span className="font-display text-2xl leading-none font-bold tracking-[0.26em]">ODY</span>
        </div>
        <h1 className="mt-5 font-display text-xl font-semibold text-balance">취향을 좌표로 바꿉니다</h1>
        <p className="mt-2 text-[12.5px] leading-[1.62] text-ink-2">
          수백만 곡이 소리의 성질에 따라 한 장의 별지도에 올라가 있습니다. 계정을 연결하면 직접 한 바퀴 돌면서 탐색하는 법을 익히게 됩니다.
        </p>
        <div className="mt-6">
          <GoogleLoginButton />
        </div>
        <p className="lbl mt-3 text-center normal-case tracking-normal">소셜 로그인은 Google 한 곳만 사용합니다 · AUTH-01</p>
      </div>
    </main>
  );
}
