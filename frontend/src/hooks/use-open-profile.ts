"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ROUTES } from "@/constants";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 남의 프로필을 연다 (S15P21A405-593 · 659).
 *
 * **탭 화면에서는 지도로 돌아간 뒤 연다.** 프로필은 지도 위 시트(`right-panel`, z-20)로
 * 뜨는데, 하단 탭이 여는 화면(`panel-screen`, z-22)은 **그 위를 덮는다.** 그래서 주변 사람
 * 목록이나 레이더에서 사람을 눌러도 프로필이 그 화면 뒤에 열려 **아무 일도 안 일어난 것처럼
 * 보였다** — 눌린 것 같지도 않으니 계속 다시 누르게 된다.
 *
 * 덮개 순서를 바꾸는 대신 **자리를 옮긴다.** 탭 화면은 목적지고 프로필은 지도 위에서 보는
 * 것이라, 프로필을 보려면 지도로 돌아가는 것이 원래의 문법이다.
 *
 * **패널 안에서 눌렀으면 `drill` 이다** — 지금 패널(차트·주변 사람·다른 프로필)이 돌아갈 자리로 쌓인다.
 * 폰 탭 화면(`/chart`·`/friends`)에서는 시트가 닫혀 있어 스택에 쌓을 것이 없다 — 그래서 탭 화면일 때는
 * 그 화면을 돌아갈 자리로 직접 넣어 준다. 지도 표식에서 열 때는 `openFeed` 로 새로 연다.
 */
export function useOpenProfile(): (email: string, opts?: { drill?: boolean }) => void {
  const openFeed = usePanelStore((s) => s.openFeed);
  const drill = usePanelStore((s) => s.drill);
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (email: string, opts: { drill?: boolean } = {}) => {
      if (opts.drill) {
        const fromTab = pathname === ROUTES.chart ? ({ panel: "chart" } as const) : pathname === ROUTES.friends ? ({ panel: "friends" } as const) : null;
        if (fromTab) {
          // 탭 화면에서 왔다 — 시트가 없으니 스택을 직접 세운다
          openFeed(email);
          usePanelStore.setState({ history: [fromTab] }, false, "drill/fromTab");
        } else {
          drill({ panel: "feed", profileEmail: email });
        }
      } else {
        openFeed(email);
      }
      if (pathname !== ROUTES.home) router.push(ROUTES.home);
    },
    [openFeed, drill, pathname, router],
  );
}
