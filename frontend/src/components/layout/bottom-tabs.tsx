"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FriendsIcon, MapIcon, RankIcon, UserIcon } from "@/components/common/icons";
import { ROUTES } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";

/**
 * 폰 맨 아래 고정 탭바 (S15P21A405-417). **좁은 화면에서만 그린다** — 데스크톱은 우상단
 * 레일이 같은 일을 하고, 이 컴포넌트는 `max-tablet:` 안에서만 보인다.
 *
 *   [주변 사람] [랭킹] [지도] [마이페이지]
 *
 * **탭은 목적지다.** 주변 탐색·여정처럼 지도를 바꾸는 *동작*은 여기 없다 — 지도 탭 안에서만
 * 나온다 (`map-actions.tsx`). 목적지와 동작을 한 줄에 섞어 놓으니 "랭킹을 보는 중인데 주변
 * 탐색이 켜진" 상태가 생겼다.
 *
 * 각 탭은 **제 경로로 간다** — 한 화면에 전부 겹쳐 띄우는 대신 하위 페이지로 나눈다.
 * 지도는 그 아래에 살아 있다 (`app-shell.tsx`), 그래서 오가도 다시 안 불러온다.
 */
interface TabDef {
  href: string;
  label: string;
  icon: ReactNode;
  /** 유저 테스트 동안 감춘 기능인가 (S15P21A405-333). 지도는 언제나 있다 */
  enabled: boolean;
}

export default function BottomTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const panelEnabled = usePanelEnabled();

  const tabs: TabDef[] = [
    { href: ROUTES.friends, label: "주변 사람", icon: <FriendsIcon />, enabled: panelEnabled.friends },
    { href: ROUTES.chart, label: "랭킹", icon: <RankIcon />, enabled: panelEnabled.chart },
    { href: ROUTES.home, label: "지도", icon: <MapIcon />, enabled: true },
    { href: ROUTES.me, label: "마이페이지", icon: <UserIcon />, enabled: panelEnabled.feed },
  ];

  return (
    <div
      data-hud
      data-tabbar
      className="glass-bar fixed right-gutter-sm bottom-hud-b left-gutter-sm z-[23] hidden rounded-[22px] rounded-t-none border-t-0 max-tablet:block"
    >
      <nav aria-label="네비" className="flex h-tabbar items-center justify-around">
        {tabs
          .filter((t) => t.enabled)
          .map((t) => {
            const active = pathname === t.href;
            return (
              <button
                key={t.href}
                type="button"
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                onClick={() => router.push(t.href)}
                className={`grid h-10 w-10 place-items-center rounded-pill transition-colors duration-fast ${
                  active ? "grad-bg text-void shadow-glow-azure" : "text-ink-3"
                }`}
              >
                {t.icon}
              </button>
            );
          })}
      </nav>
    </div>
  );
}
