"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ROUTES } from "@/constants";
import { usePanelStore, type PanelReturn } from "@/stores/use-panel-store";

/**
 * 남의 프로필을 연다 (S15P21A405-593).
 *
 * **탭 화면에서는 지도로 돌아간 뒤 연다.** 프로필은 지도 위 시트(`right-panel`, z-20)로
 * 뜨는데, 하단 탭이 여는 화면(`panel-screen`, z-22)은 **그 위를 덮는다.** 그래서 주변 사람
 * 목록이나 레이더에서 사람을 눌러도 프로필이 그 화면 뒤에 열려 **아무 일도 안 일어난 것처럼
 * 보였다** — 눌린 것 같지도 않으니 계속 다시 누르게 된다.
 *
 * 덮개 순서를 바꾸는 대신 **자리를 옮긴다.** 탭 화면은 목적지고 프로필은 지도 위에서 보는
 * 것이라, 프로필을 보려면 지도로 돌아가는 것이 원래의 문법이다 (`feed-panel` 의 팔로워
 * 목록도 같은 이유로 그렇게 한다).
 *
 * 데스크톱에는 탭 화면이 없어 언제나 `/` 이므로 이 훅은 `openFeed` 와 같게 동작한다.
 */
export function useOpenProfile(): (email: string, back?: PanelReturn | null) => void {
  const openFeed = usePanelStore((s) => s.openFeed);
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    // 돌아갈 자리는 **여는 쪽이 넘긴다** (S15P21A405-610) — 여기서는 그대로 전달만 한다
    (email: string, back: PanelReturn | null = null) => {
      openFeed(email, back);
      if (pathname !== ROUTES.home) router.push(ROUTES.home);
    },
    [openFeed, pathname, router],
  );
}
