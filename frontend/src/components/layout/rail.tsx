"use client";

import { FriendsIcon, JourneyIcon, RankIcon } from "@/components/common/icons";
import { usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import NearbyExploreButton from "./nearby-explore-button";
import ProfileButton from "./profile-button";
import RailButton from "./rail-button";

/**
 * #rail — 우상단 가로 네비. **알약 하나 + 프사** (S15P21A405-434):
 *
 *   [주변 사람 · 랭킹 · 주변 탐색 · 여정]  (프사)
 *
 * 전부 아이콘만이고 이름은 툴팁이다. 탭과 동작을 두 알약으로 갈랐던 것(S15P21A405-427)을 합쳤다 —
 * 도움말까지 세 덩어리가 나란히 서니 번잡했다. 도움말(?)은 좌하단 계기판 옆으로 갔다.
 * 높이는 44px: 안쪽 버튼 40 + 알약 패딩 1·1 + 테두리 1·1. 프사 버튼도, 가운데 검색 알약도 44 다 (S15P21A405-440).
 *
 * 유저 테스트 동안 감춘 기능은 빠진다 (S15P21A405-333, `constants/features.ts`).
 * 지금은 주변 탐색·여정만 남는다.
 */
export default function Rail() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const toggle = usePanelStore((s) => s.toggle);
  /**
   * 만든 여정이 없으면 여정 버튼은 **만들기 상자를 바로 연다** (S15P21A405-352).
   * 그 상태의 여정 패널은 "여정 만들기" 버튼 하나가 전부라, 한 번 더 누르게 하는 빈 화면이었다.
   * (그 통로가 우측 패널을 닫으므로 주변 탐색 뷰도 같이 내려간다 — `use-open-journey-composer`)
   *
   * **한 번 더 누르면 닫힌다** (S15P21A405-434) — 만들기 상자가 떠 있으면 상자를, 패널이면 패널을.
   * 예전에는 상자가 떠 있는 채로 다시 눌러도 상자를 또 열 뿐이라 닫을 길이 X 하나였다.
   */
  const hasJourney = useJourneyStore((s) => s.isRouteRequested);
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);
  const closeComposer = useJourneyStore((s) => s.closeComposer);
  const openComposer = useOpenJourneyComposer();
  const pressJourney = () => {
    if (composerOpen) closeComposer();
    else if (hasJourney) toggle("journey");
    else openComposer("start");
  };
  const panelEnabled = usePanelEnabled();

  return (
    /*
     * 좁은 화면에서는 **아래로 내려와 재생바와 한 덩어리가 된다** (S15P21A405-417).
     * 375px 상단은 마크·검색·레일이 한 줄을 다투는 자리였고, 아래는 재생바 하나만 덩그러니
     * 있어 조각이 따로 떠 보였다. 내려 보내면 상단이 비어 지도가 넓어지고, 바텀시트가
     * 들어올 때(S15P21A405-416) 시트가 이 묶음 위로 올라오면 된다.
     * 알약 모양은 그대로 둔다 — 떠 있는 유리라는 디자인 언어가 이 앱의 기본이다.
     */
    <div data-hud className="absolute top-hud-t right-[18px] z-[22] flex items-center gap-2 max-tablet:top-auto max-tablet:bottom-[calc(var(--spacing-hud-b)+96px)] max-tablet:left-gutter-sm max-tablet:right-gutter-sm max-tablet:justify-between">
      <nav aria-label="네비" className="glass-liquid flex gap-0.5 rounded-pill! p-px">
        {panelEnabled.friends && (
          <RailButton label="주변 사람" active={activePanel === "friends"} onClick={() => toggle("friends")} data-tutorial="friends">
            <FriendsIcon />
          </RailButton>
        )}
        {panelEnabled.chart && (
          <RailButton label="랭킹" active={activePanel === "chart"} onClick={() => toggle("chart")} data-tutorial="chart">
            <RankIcon />
          </RailButton>
        )}
        <NearbyExploreButton />
        {panelEnabled.journey && (
          <RailButton label="여정" active={composerOpen || activePanel === "journey"} onClick={pressJourney} data-tutorial="journey">
            <JourneyIcon size={16} />
          </RailButton>
        )}
      </nav>
      {panelEnabled.feed && <ProfileButton />}
    </div>
  );
}
