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
 * #panel — 우측에 떠 있는 글래스 패널. activePanel 에 따라 하위 패널 하나만 렌더.
 *
 * 오른쪽 여백은 좌하단 계기판과 같은 18px 다 (S15P21A405-427) — 레일이 우상단으로 올라가 옆자리가 비었다.
 * 아래로는 우하단 플레이어바(52px) 위에서 끝난다: 68(위) + 18 + 52 + 12(틈) = 150.
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
      className={`animate-tin absolute top-[68px] right-[18px] z-20 flex max-h-[calc(100vh-150px)] w-right-panel flex-col transition-[transform,opacity] duration-500 ease-out ${
        /*
          접으면 **몸통 18px 만 남기고** 들어간다 (S15P21A405-427). 싹 밀어 넣으면 거기에 무엇이
          있었는지가 안 읽힌다 — 좌하단 계기판이 몸통을 조금 남기는 것(`COLLAPSED_PEEK_PX`)과 같은 이유다.
          핸들(22px)은 그 왼쪽에 붙어 화면 안에 온전히 남는다.

          376 = 패널이 제자리에서 오른쪽으로 갈 거리.
            제자리 왼쪽 끝 = 화면오른쪽 - (패널폭 376 + 여백 18) = -394
            목표 왼쪽 끝   = 화면오른쪽 - 남길 몸통 18 = -18
            376 = 394 - 18

          들어가면서 **흐려진다**. 자리만 옮기면 화면 끝에서 잘린 것처럼 보이는데, 같이 옅어지면
          "물러났다" 로 읽힌다. 다 지우지 않고 0.6 에서 멈추는 이유는 핸들이 같이 흐려지기
          때문이다 — 되돌릴 손잡이는 읽혀야 한다 (opacity 는 자식이 부모보다 진해질 수 없다).

          500ms 는 300ms 보다 반 박자 느리다. 거리가 376px 로 길어서 300ms 면 미끄러지는 게
          아니라 튀어 들어간다.

          **클래스를 런타임에 조합하지 않는다** — Tailwind 는 소스를 훑어 유틸리티를 만들어서
          문자열로 짜 넣으면 CSS 가 생기지 않는다. 그래서 계산 결과를 직접 적는다.
        */
        collapsed ? "translate-x-[376px] opacity-60" : "opacity-100"
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
