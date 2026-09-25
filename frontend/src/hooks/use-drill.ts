"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ROUTES } from "@/constants";
import { usePanelStore, type PanelReturn } from "@/stores/use-panel-store";

/**
 * 탭 화면에서 패널을 타고 들어갈 때 **돌아갈 자리**로 세울 그 탭의 패널.
 *
 * `/me` 는 언제나 **내 피드**다 (`profileEmail: null`) — 남의 프로필을 보다 마이페이지를 눌러도
 * 내 것이 떠야 하므로 주소가 곧 주인이다 (S15P21A405-577).
 */
const TAB_PANEL: Record<string, PanelReturn> = {
  [ROUTES.me]: { panel: "feed", profileEmail: null },
  [ROUTES.friends]: { panel: "friends" },
  [ROUTES.chart]: { panel: "chart" },
};

/**
 * 패널을 **타고 들어간다** — 탭 화면에서는 지도로 돌아가서 연다 (S15P21A405-666).
 *
 * 하위 패널은 지도 위 시트(`right-panel`, z-20)로 뜨는데 하단 탭이 여는 화면
 * (`panel-screen`, z-22)이 **그 위를 덮는다.** 그래서 마이페이지에서 플리를 눌러도 시트가
 * 그 화면 뒤에 열려 **아무 일도 안 일어난 것처럼 보였다** — 지도 탭을 눌러야 그제서야 보인다.
 *
 * 덮개 순서를 바꾸지 않는다. 탭 화면이 지도를 가리는 건 의도된 것이고, 하위 패널을 보는
 * 자리가 지도 위라는 것도 그대로다. **자리를 옮기는 쪽**이 맞다.
 *
 * **돌아갈 자리도 여기서 세운다.** 탭 화면에는 시트가 없어서 `drill` 이 찍는 스냅샷은
 * 직전에 지도에서 보던 낡은 패널이다. 그대로 두면 뒤로가기가 엉뚱한 곳으로 간다.
 *
 * 같은 증상을 S15P21A405-593(주변 사람) · 659(프로필)에서 한 번씩 고쳤고, 그때마다 그 화면
 * 안에서만 막았다. 세 번째로 같은 자리에서 나와서(플리) 여기 한 곳에 모은다.
 */
export function useDrill(): (target: PanelReturn) => void {
  const drill = usePanelStore((s) => s.drill);
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (target: PanelReturn) => {
      drill(target);
      const fromTab = TAB_PANEL[pathname];
      if (!fromTab) return;
      // 탭 화면에서 왔다 — 돌아갈 자리를 그 화면으로 덮어쓰고 지도로 옮긴다
      usePanelStore.setState({ history: [fromTab] }, false, "drill/fromTab");
      router.push(ROUTES.home);
    },
    [drill, pathname, router],
  );
}
