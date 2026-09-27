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

  /**
   * **지도가 첫 칸이다** (S15P21A405-532). 기본 화면이자 다른 탭에서 돌아오는 자리인데
   * 가운데 있으면 "여기가 홈" 이라는 것이 안 읽힌다 — 앱 탭바는 왼쪽 끝이 홈 자리다.
   */
  const tabs: TabDef[] = [
    { href: ROUTES.home, label: "지도", icon: <MapIcon />, enabled: true },
    { href: ROUTES.friends, label: "주변 사람", icon: <FriendsIcon />, enabled: panelEnabled.friends },
    { href: ROUTES.chart, label: "랭킹", icon: <RankIcon />, enabled: panelEnabled.chart },
    { href: ROUTES.me, label: "마이페이지", icon: <UserIcon />, enabled: panelEnabled.feed },
  ];

  return (
    <div
      data-hud
      data-tabbar
      /*
       * **화면 맨 아래에 붙인다** (S15P21A405-417). 여백을 띄운 둥근 상자로 떠 있으니
       * 화면 끝과 바 사이에 뜬 지도 조각이 남아 어정쩡했다 — 앱들이 쓰는 대로 바닥에 깐다.
       * 안전영역(홈 인디케이터)만큼 아래에 패딩을 준다.
       *
       * **유리가 아니라 거의 검정인 판이다** (S15P21A405-703, 사용자 결정). 테두리도 없다.
       * 윗모서리는 30px — 패널·시트 윗모서리와 같은 값(`--radius-sheet`). 바로 위 재생바는 각졌고,
       * 이 모서리 밑으로 비는 자리는 재생바가 그만큼 뒤로 내려와 메운다(`bottom-bar.tsx`).
       * 이 바는 폰에서만 보이므로 넓은 화면에는 영향이 없다.
       */
      className="fixed inset-x-0 bottom-0 z-[23] hidden rounded-t-sheet bg-tabbar pb-[env(safe-area-inset-bottom,0px)] max-tablet:block"
    >
      <nav aria-label="네비" className="flex h-tabbar items-center justify-around px-gutter-sm">
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
                /*
                  **칠하지 않고 물들인다** (S15P21A405-417). 칸이 화면 폭의 1/4 이라 그라데이션을
                  채우면 알약이 아니라 색 블록 하나가 되고 밑의 글자까지 덮는다 — 아이콘·글자
                  색만 바꾸는 편이 탭바 문법에 맞는다.
                */
                className={`flex h-tabbar flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-fast ${
                  active ? "text-teal" : "text-ink-3"
                }`}
              >
                {t.icon}
                <span className="text-2xs leading-none">{t.label}</span>
              </button>
            );
          })}
      </nav>
    </div>
  );
}
