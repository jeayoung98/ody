"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ROUTES } from "@/constants";
import { useExchangeCodeMutation } from "@/hooks/mutations/use-exchange-code-mutation";

/**
 * 구글 로그인 착지점 (AUTH-02). 백엔드가 `?code=` 를 붙여 여기로 보낸다.
 * code 를 accessToken 으로 바꿔 저장한 뒤 홈으로 넘긴다. 실패하면 로그인으로 되돌린다.
 */
export default function OAuthCallback({ code }: { code: string | null }) {
  const router = useRouter();
  const exchange = useExchangeCodeMutation();
  // StrictMode 이중 실행·리렌더로 같은 code 를 두 번 교환하지 않게 한 번만 태운다
  const fired = useRef(false);

  useEffect(() => {
    if (!code || fired.current) return;
    fired.current = true;
    exchange.mutate(code, { onSuccess: () => router.replace(ROUTES.home) });
  }, [code, exchange, router]);

  const failed = !code || exchange.isError;

  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center p-6">
      <div className="glass animate-tin relative w-full max-w-sm rounded-[16px]! px-6 py-7 text-center">
        {failed ? (
          <>
            <h1 className="font-display text-lg font-semibold">로그인하지 못했어요</h1>
            <p className="mt-2 text-[12.5px] leading-[1.62] text-ink-2">
              {code ? (exchange.error as Error | undefined)?.message : "인증 코드가 없습니다."}
            </p>
            <Link href={ROUTES.login} className="lbl mt-5 inline-block rounded-pill border border-line px-3 py-1.5 text-ink-2 hover:border-line-2 hover:text-ink">
              다시 로그인
            </Link>
          </>
        ) : (
          <>
            <span className="grad-bg mx-auto block h-[26px] w-[26px] animate-pulse-dot rounded-[8px]" />
            <p className="mt-4 text-[12.5px] text-ink-2">계정을 연결하는 중이에요…</p>
          </>
        )}
      </div>
    </main>
  );
}
