"use client";

import NearbyExploreButton from "./nearby-explore-button";
import PlayerBar from "./player-bar";

/** #bottomBar — 하단 중앙: 플레이어(트랜스포트) + 주변 탐색 액션 */
export default function BottomBar() {
  return (
    <footer data-hud className="absolute bottom-[18px] left-1/2 z-[21] flex w-[min(640px,52vw)] -translate-x-1/2 items-stretch gap-2">
      <PlayerBar />
      <NearbyExploreButton />
    </footer>
  );
}
