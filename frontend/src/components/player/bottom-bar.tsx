"use client";

import PlayerBar from "./player-bar";
import YoutubeEmbed from "./youtube-embed";

/**
 * #bottomBar — 우하단 플레이어(트랜스포트). 폭은 우측 패널과 같다 (`w-right-panel`, S15P21A405-427) —
 * 패널이 이 위에서 끝나므로 한 기둥으로 읽힌다. 주변 탐색 버튼은 우상단 네비로 갔다 (`layout/rail.tsx`).
 * 그 위에 공식 플레이어 임베드가 뜬다 — `videoId` 가 있는 곡일 때만이다 (규칙 6 D15).
 */
export default function BottomBar() {
  return (
    <>
      <YoutubeEmbed />
      <footer data-hud className="absolute right-[18px] bottom-[18px] z-[21] flex w-right-panel items-stretch">
        <PlayerBar />
      </footer>
    </>
  );
}
