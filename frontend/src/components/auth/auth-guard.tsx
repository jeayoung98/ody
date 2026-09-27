"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Logo from "@/components/common/logo";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useForcePublic } from "@/hooks/use-force-public";
import { readStorage, resyncStorage, subscribeStorage } from "@/lib/storage";

/**
 * 구독 값이 실제 저장소와 어긋났으면 한 번 깨운다 (S15P21A405-588).
 *
 * 어긋나는 자리는 하이드레이션이다 — 서버 스냅샷이 "토큰 없음" 이라 그 값으로 커밋될 수 있고,
 * `useSyncExternalStore` 는 알림이 와야 다시 읽으므로 그 뒤로 저장소를 건드리는 사람이 없으면
 * **영영 그대로다.** 로그인해도 스플래시만 돌고 새로고침해야 지도가 뜨던 것이 이것이다.
 *
 * 한 번 깨우면 모두가 진짜 값을 다시 읽어 어긋남이 사라지므로 두 번은 안 돈다.
 */
function useResyncToken(hasToken: boolean): void {
  useEffect(() => {
    if (hasToken !== !!readStorage<string>(STORAGE_KEYS.accessToken)) resyncStorage();
  }, [hasToken]);
}

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

/** 로그인 판정 동안의 로딩 화면 — 좌상단과 같은 로켓 마크가 숨쉰다 (S15P21A405-651) */
function Splash() {
  return (
    <main className="stage-bg fixed inset-0 flex items-center justify-center">
      <Logo size={56} radius={20} className="animate-pulse-dot shadow-[0_0_36px_-6px_rgba(92,157,255,.8)]" />
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
  useResyncToken(hasToken);
  const { data: me } = useMeQuery();
  const needsNickname = requireNickname && !!me && !me.nickname;
  // 폐지된 공개/비공개의 잔해를 치운다 — 내 정보가 온 뒤라야 토큰이 살아 있는 것이 확실하다
  useForcePublic(!!me);

  /**
   * **보낼지 말지는 저장소를 그 자리에서 다시 읽고 정한다** (S15P21A405-588).
   *
   * 위 `hasToken` 은 화면을 그리는 값이라 서버 스냅샷(항상 false)으로 커밋되는 순간이 있다.
   * 그 값으로 여기서 판단하면 **토큰이 있는데도 로그인으로 보낸다.** 그러면 로그인 화면의
   * `GuestGate` 가 다시 토큰을 보고 홈으로 되돌려서 홈↔로그인을 오간다 — 사용자에게는
   * 로그인했는데 로딩만 도는 화면으로 보이고, 새로고침해야 지도가 뜬다.
   *
   * effect 는 브라우저에서만 도므로 여기서는 **진짜 값**을 읽을 수 있다. 그리는 쪽은 그대로
   * 둔다 — 잠깐 스플래시가 보였다가 값이 들어오면 알아서 바뀐다. 보내는 것만 되돌릴 수 없다.
   */
  useEffect(() => {
    if (!readStorage<string>(STORAGE_KEYS.accessToken)) router.replace(ROUTES.login);
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
  useResyncToken(hasToken);

  /** 반대쪽도 같은 이유로 저장소를 직접 읽는다 (S15P21A405-588) — `AuthGuard` 주석 참고 */
  useEffect(() => {
    if (readStorage<string>(STORAGE_KEYS.accessToken)) router.replace(ROUTES.home);
  }, [hasToken, router]);

  if (hasToken) return <Splash />;
  return <>{children}</>;
}
