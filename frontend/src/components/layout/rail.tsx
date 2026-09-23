"use client";

import { FriendsIcon, JourneyIcon, RankIcon } from "@/components/common/icons";
import { useFeatures, usePanelEnabled } from "@/hooks/use-features";
import { useOpenJourneyComposer } from "@/hooks/use-open-journey-composer";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";
import ContestButton from "./contest-button";
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
    else openComposer();
  };
  const panelEnabled = usePanelEnabled();
  const features = useFeatures();

  return (
    /*
     * **폰에서는 통째로 숨는다** (S15P21A405-417). 좁은 화면의 네비는 하단 고정 탭바가
     * 맡고(`bottom-tabs.tsx`), 목록도 아예 다르다 — 거기는 목적지 넷(주변 사람·랭킹·지도·
     * 마이페이지)이고 여기는 목적지 셋에 동작 둘이 섞여 있다. 한 컴포넌트를 양쪽 모양으로
     * 비틀어 쓰다가 "랭킹을 보는 중인데 주변 탐색이 켜진" 상태가 생겼다.
     */
    <div data-hud className="absolute top-hud-t right-[18px] z-[22] flex items-center gap-2 max-tablet:hidden">
      {/* 이벤트(콘테스트)는 기간이 있어 알약 밖 왼쪽에 따로 선다 (S15P21A405-602). 진행 중인 회차가 없으면 없다 */}
      {features.contest && <ContestButton />}
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
            <JourneyIcon size={17} />
          </RailButton>
        )}
      </nav>
      {/* 프사는 알약 밖에 따로 선다 (S15P21A405-434) — "나" 는 목적지가 아니라 주인이라 따로 */}
      {panelEnabled.feed && <ProfileButton />}
    </div>
  );
}
