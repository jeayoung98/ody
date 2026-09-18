"use client";

import { FriendsIcon, JourneyIcon, RankIcon, UserIcon } from "@/components/common/icons";
import { NAV_ITEMS, type PanelType } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import NearbyExploreButton from "./nearby-explore-button";
import RailButton from "./rail-button";

const ICONS: Record<(typeof NAV_ITEMS)[number]["key"], React.ReactNode> = {
  friends: <FriendsIcon />,
  chart: <RankIcon />,
  feed: <UserIcon />,
};

/**
 * #rail — 우상단 가로 네비, 도움말(?) 바로 왼쪽. 알약 둘 (S15P21A405-427):
 *
 *   [주변 사람 · 차트 · 내 프로필]  [주변 탐색 · 여정]  (?)
 *          탭 = 패널을 연다            동작 = 지도 뷰를 바꾼다
 *   탭은 큰 원 + 아래 작은 이름, 동작은 아이콘만 (S15P21A405-432). 둘 다 이름은 툴팁으로도 뜬다.
 *
 * 우측 세로 가운데에 있던 것을 올렸다 — 레일 몸 때문에 우측 패널이 화면 가장자리에서 74px
 * 들어와 있었고, 주변 탐색은 하단 플레이어바 옆에 혼자 떨어져 있어 여정과 짝으로 읽히지 않았다.
 * 동작 알약 높이는 도움말 버튼(38px)과 같다: 안쪽 버튼 34 + 알약 패딩 2·2. 탭 알약은 이름 줄만큼 더 높다.
 *
 * 유저 테스트 동안 감춘 기능의 탭은 빠진다 (S15P21A405-333, `constants/features.ts`).
 * 탭이 하나도 없으면 탭 알약은 그리지 않는다 — 지금은 동작 알약만 보인다.
 */
export default function Rail() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const toggle = usePanelStore((s) => s.toggle);
  /**
   * 만든 여정이 없으면 여정 버튼은 **만들기 상자를 바로 연다** (S15P21A405-352).
   * 그 상태의 여정 패널은 "여정 만들기" 버튼 하나가 전부라, 한 번 더 누르게 하는 빈 화면이었다.
   * (그 통로가 우측 패널을 닫으므로 주변 탐색 뷰도 같이 내려간다 — `use-open-journey-composer`)
   */
  const hasJourney = useJourneyStore((s) => s.isRouteRequested);
  const openComposer = useOpenJourneyComposer();
  const panelEnabled = usePanelEnabled();
  const tabs = NAV_ITEMS.filter((item) => panelEnabled[item.key]);

  return (
    <div data-hud className="absolute top-4 right-[66px] z-[22] flex items-start gap-2">
      {tabs.length > 0 && (
        <nav aria-label="패널" className="glass flex gap-0.5 rounded-pill! p-0.5">
          {tabs.map((item) => (
            <RailButton key={item.key} label={item.label} caption active={activePanel === item.key} onClick={() => toggle(item.key as PanelType)} data-tutorial={item.key}>
              {ICONS[item.key]}
            </RailButton>
          ))}
        </nav>
      )}
      <nav aria-label="지도 동작" className="glass flex gap-0.5 rounded-pill! p-0.5">
        <NearbyExploreButton />
        {panelEnabled.journey && (
          <RailButton label="여정" active={activePanel === "journey"} onClick={() => (hasJourney ? toggle("journey") : openComposer("start"))} data-tutorial="journey">
            <JourneyIcon size={16} />
          </RailButton>
        )}
      </nav>
    </div>
  );
}
