"use client";

import { FriendsIcon, JourneyIcon, RankIcon, UserIcon } from "@/components/common/icons";
import { NAV_ITEMS, type PanelType } from "@/constants";
import { usePanelStore } from "@/stores/use-panel-store";
import RailButton from "./rail-button";

const ICONS: Record<(typeof NAV_ITEMS)[number]["key"], React.ReactNode> = {
  friends: <FriendsIcon />,
  journey: <JourneyIcon />,
  chart: <RankIcon />,
  feed: <UserIcon />,
};

/** #rail — 우측 세로 글래스 레일: 주변 사람 · 여정 · 차트 · 내 프로필 */
export default function Rail() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const toggle = usePanelStore((s) => s.toggle);

  return (
    <nav className="glass absolute top-1/2 right-[18px] z-[21] flex -translate-y-1/2 flex-col gap-1.5 rounded-pill! p-1.5">
      {NAV_ITEMS.map((item) => (
        <RailButton key={item.key} label={item.label} active={activePanel === item.key} onClick={() => toggle(item.key as PanelType)}>
          {ICONS[item.key]}
        </RailButton>
      ))}
    </nav>
  );
}
