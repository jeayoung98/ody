"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID, ROUTES } from "@/constants";
import { useGoogleLoginMutation } from "@/hooks/mutations/use-google-login-mutation";
import GoogleGlyph from "./google-glyph";

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
 * **위 로그인 버튼과 키를 맞춘다** (S15P21A405-652).
 *
 * 구글이 그려 주는 최대 높이는 `size: "large"` 의 **40px** 이고 그 이상은 못 받는다.
 * 이메일 로그인 버튼은 47.25px 이라(`email-login-form` 의 `py-3` 24 + 줄높이 23.25, 실측 47.3)
 * 나란히 두면 아래 것만 낮아 보인다.
 *
 * **확대하지 않는다.** 처음에 `scale` 로 키웠더니 **글씨까지 같이 커졌다** — 맞춰야 하는 건
 * 상자 높이지 글자가 아니다. 지금은 보이는 버튼을 우리가 그리므로 이 높이를 그대로 쓴다.
 *
 * 로그인 버튼 쪽 글자 크기나 여백을 바꾸면 **여기도 같이 바꾼다.** 두 값이 따로 놀면 다시
 * 높이가 어긋난다.
 */
const MATCH_HEIGHT = 47.25;

/**
 * 구글 로그인 (AUTH-01/02).
 * 구글이 브라우저에서 idToken 을 발급하고, 그걸 백엔드 `POST /api/auth/login/google` 이 검증한다.
 * 버튼은 구글이 직접 렌더한다 — 직접 만든 버튼으로는 idToken 을 받을 수 없다.
 * 닉네임이 비어 있으면 신규 사용자이므로 닉네임 설정으로 보낸다 (AUTH-01).
 */
export default function GoogleLoginButton() {
  const router = useRouter();
  const { mutate, isError, error } = useGoogleLoginMutation();
  /** 구글이 진짜 버튼을 그리는 자리. 투명하게 덮여 있다 (S15P21A405-652) */
  const slot = useRef<HTMLDivElement>(null);
  /** 폭을 재는 자리 — 카드 폭 전체를 차지한다. 그 값을 구글에 넘긴다 (S15P21A405-575) */
  const room = useRef<HTMLDivElement>(null);
  /** 마지막으로 구글에 넘긴 폭. 같은 값이면 다시 안 그린다 */
  const lastWidth = useRef(0);

  const renderGoogleButton = useCallback(() => {
    if (!slot.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: ({ credential }) =>
        mutate(credential, {
          onSuccess: ({ user }) => router.replace(user.nickname ? ROUTES.home : ROUTES.nickname),
        }),
    });

    /**
     * **폭을 담는 자리에서 잰다** (S15P21A405-575).
     *
     * 예전에는 `width: 320` 이 박혀 있었다. 데스크톱 카드에는 들어가지만 **375px 화면에서
     * 담는 자리는 269px** 이라(실측) 구글이 그리는 흰 버튼이 좌우로 25px 씩 빠져나와
     * 카드 밖에 **흰 띠처럼** 걸렸다. 버튼을 구글이 직접 그리므로 CSS 로는 못 줄인다 —
     * 넘겨주는 수밖에 없다.
     *
     * 구글이 받는 상한이 400 이고 너무 좁으면 글자가 잘리므로 **200~400 으로 가둔다.**
     */
    // 폭은 **바깥 상자**에서 잰다 (S15P21A405-652). `slot` 은 덮개라 제 폭이 곧 버튼 폭이다
    const box = room.current ?? slot.current;
    const available = box.clientWidth || box.getBoundingClientRect().width;
    const width = Math.round(Math.min(400, Math.max(200, available)));
    lastWidth.current = width;

    window.google.accounts.id.renderButton(slot.current, {
      type: "standard",
      // 눈에 안 보이므로 테마는 무엇이든 상관없다. 덮개가 어긋났을 때 알아보기 쉬우라고 흰 것을 둔다
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "center",
      locale: "ko",
      width,
    });
  }, [mutate, router]);

  /**
   * 화면 폭이 바뀌면 다시 그린다 — 구글 버튼은 한 번 그리면 스스로 안 늘어난다.
   * 폰을 돌리거나 창을 줄일 때 그대로 두면 다시 넘친다.
   *
   * **폭이 실제로 바뀌었을 때만** 다시 그린다. `ResizeObserver` 는 1px 흔들림에도 오는데
   * 그때마다 구글 스크립트를 다시 태우면 버튼이 깜빡인다.
   */
  useEffect(() => {
    // **바깥 상자를 본다** (S15P21A405-652). `slot` 은 덮개라 제 폭이 안 변해서 화면 변화를 못 잡는다
    const el = room.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const available = Math.round(Math.min(400, Math.max(200, el.clientWidth)));
      if (available !== lastWidth.current) renderGoogleButton();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [renderGoogleButton]);

  // 안전망이다. 코드 기본값이 있으므로 평소에는 여기로 오지 않는다 (S15P21A405-486) —
  // 기본값이 지워지는 날 버튼이 조용히 사라지는 것보다 이유가 적힌 화면이 낫다.
  if (!CLIENT_ID) {
    return (
      <p className="rounded-pill border border-line px-3 py-3 text-center text-[14.5px] leading-[1.62] text-ink-2">
        구글 로그인이 설정되지 않았습니다 — <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> 가 필요합니다.
      </p>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={renderGoogleButton} />
      {/*
        **보이는 버튼은 우리가 그리고, 구글 버튼은 투명하게 위에 덮는다** (S15P21A405-652).

        구글이 그려 주는 버튼으로는 셋을 동시에 만족시킬 수 없었다 — 흰 바탕 · 로그인 버튼과
        같은 높이 · 테두리 없음. `outline` 은 흰 바탕에 **테두리가 한 세트**라, 우리 상자를
        더 높게 잡으면 그 테두리가 안쪽에 한 겹 더 그려진 링으로 보인다. 높이를 맞추려고
        확대하면 글씨까지 커진다. 채운 테마는 테두리가 없는 대신 흰색이 아니다.

        그래서 모양은 우리가 만들고, **누르는 것은 여전히 구글 버튼**이다. idToken 은 구글이
        그린 버튼에서만 나오므로 그건 없앨 수 없다 — 대신 `opacity-0` 으로 덮어 둔다.

        **깨질 수 있는 구조다.** 구글이 버튼 마크업을 바꾸면 덮개가 어긋날 수 있고, 브랜딩
        가이드도 "구글이 그린 버튼을 쓰라" 고 한다. 그 값을 알고 고른 선택이다.
      */}
      <div ref={room} className="relative w-full" style={{ height: MATCH_HEIGHT }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2.5 rounded-pill bg-white"
        >
          <GoogleGlyph size={18} />
          <span className="text-[15px] font-medium text-[#1f1f1f]">Google 계정으로 계속하기</span>
        </div>
        {/* 진짜 버튼. 가운데 정렬해 두면 40px 짜리가 이 상자를 거의 다 덮는다 */}
        <div ref={slot} className="absolute inset-0 flex items-center justify-center opacity-0" />
      </div>
      {isError && <p className="mt-2 text-center text-[14.5px] leading-[1.62] text-ink-2">{(error as Error).message}</p>}
    </>
  );
}
