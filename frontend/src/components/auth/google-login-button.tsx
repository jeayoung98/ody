"use client";

import { API_ENDPOINTS } from "@/constants";

/**
 * 구글 로그인 (AUTH-01/02).
 * 백엔드의 Spring Security OAuth2 진입점으로 보낸다 — 구글 동의 화면을 거친 뒤 백엔드가
 * `/oauth/redirect?code=` 로 되돌려보내고 거기서 accessToken 으로 교환한다 (oauth-callback.tsx).
 * NEXT_PUBLIC_API_URL 이 비어 있으면 같은 오리진으로 나간다 — 배포 환경은 nginx 가 /oauth2 를
 * 백엔드로 넘기므로 그대로 동작하고, 로컬 dev 서버 단독으로는 404 다. 목 로그인 분기는 없앴다.
 */
export default function GoogleLoginButton() {
  const handleLogin = () => {
    // 외부(백엔드) OAuth 엔드포인트로 이동하므로 Next 라우터가 아닌 전체 페이지 이동을 사용한다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? ""}${API_ENDPOINTS.auth.googleLogin}`;
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="flex w-full items-center justify-center gap-[9px] rounded-pill bg-white px-3 py-3 text-[13px] font-semibold text-[#1f1f1f] transition-[filter] hover:brightness-95"
    >
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.7c-.3 2.1-1.7 5.3-4.8 7.4l7.4 5.7c4.4-4.1 7.2-10.1 7.2-16.7z" />
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.8l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.4-8.5 2.4-6.3 0-11.6-3.9-13.5-9.7l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
      Google 계정으로 계속하기
    </button>
  );
}
