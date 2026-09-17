"use client";

import { usePanelEnabled } from "@/hooks/use-features";
import { usePanelStore } from "@/stores/use-panel-store";
import ChartPanel from "./chart/chart-panel";
import FeedPanel from "./feed/feed-panel";
import FriendsPanel from "./friends/friends-panel";
import JourneyPanel from "./journey/journey-panel";
import PanelCollapseHandle from "./panel-collapse-handle";
import PlaylistPanel from "./playlist/playlist-panel";
import SongDetailPanel from "./song-detail/song-detail-panel";

/**
 * #panel — 우측 레일 옆에 떠 있는 글래스 패널. activePanel 에 따라 하위 패널 하나만 렌더.
 *
 * 왼쪽 가장자리 핸들로 접을 수 있다 (S15P21A405-318). 접으면 오른쪽으로 미끄러져 나가고
 * 핸들만 남는다 — **별자리는 그대로 켜져 있다.** 지도를 넓게 보려고 잠깐 치우는 동작이라
 * 패널을 닫는 것(별자리도 같이 꺼짐)과 다르다.
 */
export default function RightPanel() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const collapsed = usePanelStore((s) => s.collapsed);
  const panelEnabled = usePanelEnabled();
  if (!activePanel) return null;
  // 유저 테스트 동안 감춘 기능은 **프로그램으로 열려도** 그리지 않는다 (S15P21A405-333).
  // 레일에서만 막으면 플레이어바 컨텍스트·지도 클릭 같은 다른 길로 열려 버린다
  if (!panelEnabled[activePanel]) return null;

  return (
    <aside
      data-hud
      data-tutorial={`panel-${activePanel}`}
      className={`animate-tin absolute top-[68px] right-[74px] z-20 flex max-h-[calc(100vh-158px)] w-right-panel flex-col transition-transform duration-300 ease-out ${
        /*
          접혀도 몸통을 COLLAPSED_PEEK_PX(28px) 만큼 남긴다 (S15P21A405-406).
          **클래스를 문자열로 짜 넣지 않는다** — Tailwind 는 소스를 훑어 유틸리티를 만들기 때문에
          런타임에 조합한 이름은 CSS 가 생기지 않는다. 그래서 74 - 28 = 46 을 직접 적는다.

          **`_` 는 공백이 된다.** `calc(100%+46px)` 로 적으면 연산자 앞뒤 공백이 없어 CSS 가
          통째로 버려지고 transform 이 아예 안 걸린다 — 예전 값(`calc(100%+74px)`)이 그랬다.
        */
        collapsed ? "translate-x-[calc(100%_+_46px)]" : ""
      }`}
    >
      <PanelCollapseHandle />
      {activePanel === "song" && <SongDetailPanel />}
      {activePanel === "playlist" && <PlaylistPanel />}
      {activePanel === "feed" && <FeedPanel />}
      {activePanel === "journey" && <JourneyPanel />}
      {activePanel === "friends" && <FriendsPanel />}
      {activePanel === "chart" && <ChartPanel />}
    </aside>
  );
}
