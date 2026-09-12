"use client";

import { usePanelStore } from "@/stores/use-panel-store";
import ChartPanel from "./chart/chart-panel";
import FeedPanel from "./feed/feed-panel";
import FriendsPanel from "./friends/friends-panel";
import JourneyPanel from "./journey/journey-panel";
import PlaylistPanel from "./playlist/playlist-panel";
import SongDetailPanel from "./song-detail/song-detail-panel";

/** #panel — 우측 레일 옆에 떠 있는 글래스 패널. activePanel 에 따라 하위 패널 하나만 렌더 */
export default function RightPanel() {
  const activePanel = usePanelStore((s) => s.activePanel);
  if (!activePanel) return null;

  return (
    <aside data-hud className="animate-tin absolute top-[68px] right-[74px] z-20 flex max-h-[calc(100vh-158px)] w-right-panel flex-col">
      {activePanel === "song" && <SongDetailPanel />}
      {activePanel === "playlist" && <PlaylistPanel />}
      {activePanel === "feed" && <FeedPanel />}
      {activePanel === "journey" && <JourneyPanel />}
      {activePanel === "friends" && <FriendsPanel />}
      {activePanel === "chart" && <ChartPanel />}
    </aside>
  );
}
