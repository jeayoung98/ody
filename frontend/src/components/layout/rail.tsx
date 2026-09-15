"use client";

import { FriendsIcon, JourneyIcon, RankIcon, UserIcon } from "@/components/common/icons";
import { NAV_ITEMS, PANEL_ENABLED, type PanelType } from "@/constants";
import { usePanelStore } from "@/stores/use-panel-store";
import RailButton from "./rail-button";

const ICONS: Record<(typeof NAV_ITEMS)[number]["key"], React.ReactNode> = {
  friends: <FriendsIcon />,
  journey: <JourneyIcon />,
  chart: <RankIcon />,
  feed: <UserIcon />,
};

/**
 * #rail — 우측 세로 글래스 레일: 주변 사람 · 여정 · 차트 · 내 프로필.
 *
 * 유저 테스트 동안 감춘 기능의 항목은 빠진다 (S15P21A405-333, `constants/features.ts`).
 * 지금은 여정만 남는다.
 */
export default function Rail() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const toggle = usePanelStore((s) => s.toggle);
  const items = NAV_ITEMS.filter((item) => PANEL_ENABLED[item.key]);
  // 하나도 없으면 빈 알약만 떠 있게 된다 — 그럴 바에는 레일 자체를 안 그린다
  if (!items.length) return null;

  return (
    <nav data-hud className="glass absolute top-1/2 right-[18px] z-[21] flex -translate-y-1/2 flex-col gap-1.5 rounded-pill! p-1.5">
      {items.map((item) => (
        <RailButton key={item.key} label={item.label} active={activePanel === item.key} onClick={() => toggle(item.key as PanelType)}>
          {ICONS[item.key]}
        </RailButton>
      ))}
    </nav>
  );
}
