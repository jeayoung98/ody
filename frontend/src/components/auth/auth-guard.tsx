"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useForcePublic } from "@/hooks/use-force-public";
import { readStorage, subscribeStorage } from "@/lib/storage";

/**
 * 액세스 토큰 유무. 저장소는 브라우저에만 있으므로 서버 스냅샷은 항상 null 이다 —
 * useSyncExternalStore 를 쓰면 그 차이를 React 가 하이드레이션에서 알아서 맞춘다.
 *
 * **세션 도중에도 바뀐다** (S15P21A405-473). 재발급이 실패하면 `lib/api.ts` 가 죽은 토큰을
 * 지우는데, 예전에는 구독이 noop 이라 여기가 그걸 못 들었다 — 토큰은 없어졌는데 화면은
 * 로그인된 홈 그대로였고, 그 화면의 모든 요청이 401 을 받았다. 이제 지워지는 순간 듣는다.
 */
function useHasToken() {
  return useSyncExternalStore(
    subscribeStorage,
    () => !!readStorage<string>(STORAGE_KEYS.accessToken),
    () => false,
  );
}

function Splash() {
  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center">
      <span className="grad-bg h-[26px] w-[26px] animate-pulse-dot rounded-[10px]" />
    </main>
  );
}

/**
 * 로그인해야 볼 수 있는 화면 (AUTH-02). 토큰이 없으면 로그인으로 보낸다.
 *
 * **설문 모드여도 예외가 없다** (S15P21A405-480). 예전에는 설문 모드면 토큰 없이 통과시켰다
 * (S15P21A405-459) — 로그인이 목이라 테스터가 계정을 만들 수조차 없던 동안의 장치다. 이제
 * 테스트 모드에서도 로그인하고 쓰기로 해서 걷어냈다. 설문 모드가 가르는 것은 설문뿐이다.
 * 액세스 토큰은 localStorage/sessionStorage 에 있어서 Next middleware(쿠키만 본다)로는 판정할 수 없다.
 * @param requireNickname 닉네임이 없으면 닉네임 설정 화면으로 보낸다. 닉네임 화면 자신은 false
 */
export default function AuthGuard({ children, requireNickname = true }: { children: ReactNode; requireNickname?: boolean }) {
  const router = useRouter();
  const hasToken = useHasToken();
  const { data: me } = useMeQuery();
  const needsNickname = requireNickname && !!me && !me.nickname;
  // 폐지된 공개/비공개의 잔해를 치운다 — 내 정보가 온 뒤라야 토큰이 살아 있는 것이 확실하다
  useForcePublic(!!me);

  useEffect(() => {
    if (!hasToken) router.replace(ROUTES.login);
    else if (needsNickname) router.replace(ROUTES.nickname);
  }, [hasToken, needsNickname, router]);

  if (!hasToken || needsNickname) return <Splash />;
  return <>{children}</>;
}

/**
 * 로그인 전에만 보는 화면 (로그인·가입). 이미 로그인했으면 홈으로 되돌린다.
 */
export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasToken = useHasToken();

  useEffect(() => {
    if (hasToken) router.replace(ROUTES.home);
  }, [hasToken, router]);

  if (hasToken) return <Splash />;
  return <>{children}</>;
}
