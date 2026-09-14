"use client";

import NearbyExploreButton from "./nearby-explore-button";
import PlayerBar from "./player-bar";
import YoutubeEmbed from "./youtube-embed";

/**
 * #bottomBar — 하단 중앙: 플레이어(트랜스포트) + 주변 탐색 액션.
 * 그 위에 공식 플레이어 임베드가 뜬다 — `videoId` 가 있는 곡일 때만이다 (규칙 6 D15).
 */
export default function BottomBar() {
  return (
    <>
      <YoutubeEmbed />
      <footer data-hud className="absolute bottom-[18px] left-1/2 z-[21] flex w-[min(640px,52vw)] -translate-x-1/2 items-stretch gap-2">
        <PlayerBar />
        <NearbyExploreButton />
      </footer>
    </>
  );
}
