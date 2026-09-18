"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { useSurveyMode } from "@/hooks/use-survey-mode";
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
      <span className="grad-bg h-[26px] w-[26px] animate-pulse-dot rounded-[10px]" />
    </main>
  );
}

/**
 * 게이트가 꺼져 있다는 걸 개발 콘솔에 **한 번만** 알린다.
 * 조용히 꺼져 있으면 나중에 "로그인이 왜 안 뜨지" 를 아무도 기억하지 못한다.
 */
const SKIP_NOTICE =
  '[ODY] 설문 모드라 로그인 게이트를 건너뜁니다 (BACKEND-NOTES A-17). 켜려면 localStorage.setItem("ody:survey-mode", "false") 후 새로고침';
let warned = false;
function warnSkipped() {
  if (warned || process.env.NODE_ENV === "production") return;
  warned = true;
  console.warn(SKIP_NOTICE);
}

/**
 * 로그인을 건너뛰는가 — **설문 모드일 때만** 이다 (S15P21A405-459).
 *
 * 테스터는 계정 없이 지도를 보고, 모드를 끈 사람은 로그인해야 한다. 기능 표시(`useFeatures`)와
 * 같은 스위치라 "테스트 모드 = 계정 없이 탐색만 / 개발 모드 = 로그인하고 전부" 가 한 군데서
 * 갈린다. 예전에는 빌드타임 상수(`SKIP_LOGIN`)여서 배포본에서 모드를 꺼도 게이트가 살아나지
 * 않았다 — 로그인이 목이던 동안의 임시였다.
 *
 * **최종 배포본(`TEST_TOOLS=0`)에서는 언제나 로그인 필수다.** `surveyModeEnabled` 가 빌드
 * 스위치를 먼저 보므로 로컬스토리지로 게이트를 열 수 없다.
 */
function useSkipLogin() {
  return useSurveyMode();
}

/**
 * 로그인해야 볼 수 있는 화면 (AUTH-02). 토큰이 없으면 로그인으로 보낸다.
 * 단 {@link useSkipLogin} 이 참이면(설문 모드) 토큰 없이 그대로 통과시킨다.
 * 액세스 토큰은 localStorage/sessionStorage 에 있어서 Next middleware(쿠키만 본다)로는 판정할 수 없다.
 * @param requireNickname 닉네임이 없으면 닉네임 설정 화면으로 보낸다. 닉네임 화면 자신은 false
 */
export default function AuthGuard({ children, requireNickname = true }: { children: ReactNode; requireNickname?: boolean }) {
  const router = useRouter();
  const hasToken = useHasToken();
  const skipLogin = useSkipLogin();
  const { data: me } = useMeQuery();
  const needsNickname = requireNickname && !!me && !me.nickname;

  useEffect(() => {
    if (skipLogin) {
      warnSkipped();
      return;
    }
    if (!hasToken) router.replace(ROUTES.login);
    else if (needsNickname) router.replace(ROUTES.nickname);
  }, [skipLogin, hasToken, needsNickname, router]);

  if (skipLogin) return <>{children}</>;
  if (!hasToken || needsNickname) return <Splash />;
  return <>{children}</>;
}

/**
 * 로그인 전에만 보는 화면 (로그인·가입). 이미 로그인했으면 홈으로 되돌린다.
 * 게이트가 꺼져 있어도 **주소로 직접 들어오면 보여준다** — 그 화면을 손볼 수 있어야 한다.
 */
export function GuestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasToken = useHasToken();
  const skipLogin = useSkipLogin();

  useEffect(() => {
    if (!skipLogin && hasToken) router.replace(ROUTES.home);
  }, [skipLogin, hasToken, router]);

  if (!skipLogin && hasToken) return <Splash />;
  return <>{children}</>;
}
