"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { GOOGLE_CLIENT_ID, ROUTES } from "@/constants";
import { useGoogleLoginMutation } from "@/hooks/mutations/use-google-login-mutation";

/**
 * Google Identity Services 중 우리가 쓰는 부분만 선언한다 (@types 패키지를 새로 넣지 않는다).
 * https://developers.google.com/identity/gsi/web/reference/js-reference
 */
interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

/**
 * 구글 OAuth 클라이언트 ID. 비밀값이 아니다 (브라우저에 그대로 노출되는 값).
 * 환경변수가 없으면 코드 기본값으로 떨어진다 — 이유는 `constants/auth.ts` (S15P21A405-486).
 */
const CLIENT_ID = GOOGLE_CLIENT_ID;

/**
 * 구글 로그인 (AUTH-01/02).
 * 구글이 브라우저에서 idToken 을 발급하고, 그걸 백엔드 `POST /api/auth/login/google` 이 검증한다.
 * 버튼은 구글이 직접 렌더한다 — 직접 만든 버튼으로는 idToken 을 받을 수 없다.
 * 닉네임이 비어 있으면 신규 사용자이므로 닉네임 설정으로 보낸다 (AUTH-01).
 */
export default function GoogleLoginButton() {
  const router = useRouter();
  const { mutate, isError, error } = useGoogleLoginMutation();
  const slot = useRef<HTMLDivElement>(null);

  const renderGoogleButton = useCallback(() => {
    if (!slot.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: ({ credential }) =>
        mutate(credential, {
          onSuccess: ({ user }) => router.replace(user.nickname ? ROUTES.home : ROUTES.nickname),
        }),
    });

    window.google.accounts.id.renderButton(slot.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "center",
      locale: "ko",
      width: 320,
    });
  }, [mutate, router]);

  // 안전망이다. 코드 기본값이 있으므로 평소에는 여기로 오지 않는다 (S15P21A405-486) —
  // 기본값이 지워지는 날 버튼이 조용히 사라지는 것보다 이유가 적힌 화면이 낫다.
  if (!CLIENT_ID) {
    return (
      <p className="rounded-pill border border-line px-3 py-3 text-center text-[12.5px] leading-[1.62] text-ink-2">
        구글 로그인이 설정되지 않았습니다 — <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 가 필요합니다.
      </p>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={renderGoogleButton} />
      <div ref={slot} className="flex justify-center" />
      {isError && <p className="mt-2 text-center text-[12.5px] leading-[1.62] text-ink-2">{(error as Error).message}</p>}
    </>
  );
}
