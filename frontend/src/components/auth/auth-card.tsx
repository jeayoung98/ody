import type { ReactNode } from "react";
import Logo from "@/components/common/logo";

/** 가입·로그인·닉네임 화면의 공통 껍데기 — 별 배경 위 글래스 카드 (AUTH-01/02) */
export default function AuthCard({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center overflow-y-auto p-6">
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="glass animate-tin relative w-full max-w-[380px] rounded-[22px]! px-7 pt-8 pb-7">
        <Logo size={40} radius={20} className="mx-auto block shadow-[0_0_26px_-4px_rgba(92,157,255,.8)]" />
        <h1 className="mt-4 text-center font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h1>
        {sub && <p className="mt-2 text-center text-[14.5px] leading-[1.6] text-ink-2">{sub}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
