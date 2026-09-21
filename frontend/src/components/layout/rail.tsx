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
     * 좁은 화면에서는 **맨 아래 고정 탭바**다 (S15P21A405-417). 음악 앱들이 쓰는 그 자리 —
     * 탭바가 바닥에 깔리고 그 위에 재생바, 그 위가 내용이다. 자리가 정해져 있어서
     * 패널이 열려도 서로 안 비킨다(떠다니는 네비는 폰에서 주차할 자리가 없었다).
     *
     * **같은 버튼·같은 핸들러를 그대로 쓴다.** 갈라놓으면 기능이 한쪽에만 붙는다 —
     * 바뀌는 것은 이 바깥 상자의 자리와 버튼이 가로냐 세로냐뿐이고, 전부 `max-tablet:` 안에 있다.
     * 데스크톱 클래스는 한 글자도 안 건드린다.
     */
    <div
      data-hud
      data-tabbar
      className="absolute top-hud-t right-[18px] z-[22] flex items-center gap-2 max-tablet:top-auto max-tablet:right-gutter-sm max-tablet:bottom-hud-b max-tablet:left-gutter-sm max-tablet:z-[23] max-tablet:gap-0"
    >
      {/*
        유리 바닥판. **자리 잡는 상자와 나눠 둔다** (S15P21A405-417) — 유리의 `backdrop-filter`
        가 그 안의 `position: fixed` 를 자기 기준으로 가두기 때문이다. 한 상자에 같이 두면
        프사가 우상단으로 못 올라가고 바 안에 눌러앉는다 (실측: 화면 아래로 4px 삐져나갔다).
        데스크톱에서는 `contents` 라 상자가 아예 없어 지금과 똑같다.
      */}
      <div className="contents max-tablet:glass-bar max-tablet:block max-tablet:w-full max-tablet:rounded-[22px] max-tablet:rounded-t-none max-tablet:border-t-0">
        {/* 폰에서는 알약이 유리를 벗고 칸 넷을 고르게 벌린다 */}
        <nav
          aria-label="네비"
          className="glass-liquid flex gap-0.5 rounded-pill! p-px max-tablet:glass-off max-tablet:h-tabbar max-tablet:flex-1 max-tablet:justify-around max-tablet:gap-0 max-tablet:p-0"
        >
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
      </div>
      {/*
        프사는 알약 밖에 따로 선다 (S15P21A405-434). **폰에서도 우상단에 남는다** —
        "나" 는 목적지가 아니라 주인이고, 탭바에 끼워 넣으면 5칸이 되어 칸마다 좁아진다.
        네비가 아래로 내려가면서 우상단이 비었으므로 자리 다툼도 없다 (S15P21A405-417).
        자기 자리를 잡으려면 `fixed` 여야 한다 — 이 바는 폰에서 화면 아래에 붙은 상자라
        그 안에서 `absolute` 로는 위로 못 나간다.
      */}
      {panelEnabled.feed && <ProfileButton />}
    </div>
  );
}
