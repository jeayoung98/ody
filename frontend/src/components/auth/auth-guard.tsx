"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { readStorage } from "@/lib/storage";

/** 저장소는 이 세션 안에서 바뀌지 않는다 (바뀌면 어차피 페이지가 이동한다) */
const noopSubscribe = () => () => {};

/**
 * 액세스 토큰 유무. 저장소는 브라우저에만 있으므로 서버 스냅샷은 항상 null 이다 —
 * useSyncExternalStore 를 쓰면 그 차이를 React 가 하이드레이션에서 알아서 맞춘다.
 */
function useHasToken() {
  return useSyncExternalStore(
    noopSubscribe,
    () => !!readStorage<string>(STORAGE_KEYS.accessToken),
    () => false,
  );
}

function Splash() {
  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center">
      <span className="grad-bg h-[26px] w-[26px] animate-pulse-dot rounded-[8px]" />
    </main>
  );
}

/**
 * 로그인해야 볼 수 있는 화면 (AUTH-02). 토큰이 없으면 로그인으로 보낸다.
 * 액세스 토큰은 localStorage/sessionStorage 에 있어서 Next middleware(쿠키만 본다)로는 판정할 수 없다.
 * @param requireNickname 닉네임이 없으면 닉네임 설정 화면으로 보낸다. 닉네임 화면 자신은 false
 */
export default function AuthGuard({ children, requireNickname = true }: { children: ReactNode; requireNickname?: boolean }) {
  const router = useRouter();
  const hasToken = useHasToken();
  const { data: me } = useMeQuery();
  const needsNickname = requireNickname && !!me && !me.nickname;

  useEffect(() => {
    if (!hasToken) router.replace(ROUTES.login);
    else if (needsNickname) router.replace(ROUTES.nickname);
  }, [hasToken, needsNickname, router]);

  if (!hasToken || needsNickname) return <Splash />;
  return <>{children}</>;
}

/** 로그인 전에만 보는 화면 (로그인·가입). 이미 로그인했으면 홈으로 되돌린다 */
export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasToken = useHasToken();

  useEffect(() => {
    if (hasToken) router.replace(ROUTES.home);
  }, [hasToken, router]);

  if (hasToken) return <Splash />;
  return <>{children}</>;
}
