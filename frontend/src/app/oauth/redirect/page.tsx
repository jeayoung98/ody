import OAuthCallback from "@/components/auth/oauth-callback";

/**
 * /oauth/redirect?code=xxx — 구글 로그인 후 백엔드가 보내는 착지 페이지 (AUTH-02).
 * searchParams 를 서버에서 읽어 넘기므로 useSearchParams Suspense 경계가 필요 없다.
 */
export default async function OAuthRedirectPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <OAuthCallback code={code ?? null} />;
}
