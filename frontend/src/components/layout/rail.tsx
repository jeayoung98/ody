"use client";

import { FriendsIcon, JourneyIcon, RankIcon, UserIcon } from "@/components/common/icons";
import { NAV_ITEMS, type PanelType } from "@/constants";
import { usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
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
 * **왼쪽에 둔다** (S15P21A405-406) — 오른쪽은 패널과 그 핸들이 쓰고 있어서 셋이 한쪽에 몰렸었다.
 *
 * 가운데가 아니라 **브랜드 블록 바로 아래**에 붙인다. 왼쪽 아래를 계기판이 쓰고 있어서
 * 세로 가운데에 두면 겹친다 — 실측: 1024x768 에서 계기판이 342~750 을 차지한다.
 *
 * 유저 테스트 동안 감춘 기능의 항목은 빠진다 (S15P21A405-333, `constants/features.ts`).
 * 지금은 여정만 남는다.
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
  const items = NAV_ITEMS.filter((item) => panelEnabled[item.key]);
  // 하나도 없으면 빈 알약만 떠 있게 된다 — 그럴 바에는 레일 자체를 안 그린다
  if (!items.length) return null;

  return (
    <nav data-hud className="glass absolute top-[190px] left-[18px] z-[21] flex flex-col gap-1.5 rounded-pill! p-1.5">
      {items.map((item) => (
        <RailButton
          key={item.key}
          label={item.label}
          active={activePanel === item.key}
          onClick={() => (item.key === "journey" && !hasJourney ? openComposer("start") : toggle(item.key as PanelType))}
          data-tutorial={item.key}
        >
          {ICONS[item.key]}
        </RailButton>
      ))}
    </nav>
  );
}
