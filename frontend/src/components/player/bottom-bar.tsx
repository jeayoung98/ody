"use client";

import PlayerBar from "./player-bar";
import YoutubeEmbed from "./youtube-embed";

/**
 * #bottomBar — 우하단 플레이어(트랜스포트). 폭은 우측 패널과 같다 (`w-right-panel`, S15P21A405-427) —
 * 패널이 이 위에서 끝나므로 한 기둥으로 읽힌다. 주변 탐색 버튼은 우상단 네비로 갔다 (`layout/rail.tsx`).
 * 그 위에 공식 플레이어 임베드가 뜬다 — `videoId` 가 있는 곡일 때만이다 (규칙 6 D15).
 *
 * **좁은 화면에서는 폭을 화면에 맞춘다** (S15P21A405-417). `w-right-panel` 은 376px 이라
 * 375px 짜리 폰에서 **화면보다 넓다.** 오른쪽 여백까지 치면 394px 이 필요해서 왼쪽으로
 * 삐져나가고, 안의 내용이 줄바꿈되면서 **위로 자라 우상단 네비까지 밀고 올라갔다.**
 * 양쪽을 여백에 묶고 폭을 풀면 한 줄로 돌아온다.
 */
export default function BottomBar() {
  return (
    <>
      <YoutubeEmbed />
      <footer
        data-hud
        /*
         * 좁은 화면에서는 **탭바 바로 위**다 (S15P21A405-417). 맨 아래는 고정 탭바가
         * 가져가고(`layout/rail.tsx`), 재생바는 그 위에 얹힌다 — 음악 앱들이 쓰는 그 쌓임이다.
         * 안전영역은 탭바가 이미 먹었으므로 여기서 또 더하면 두 번 밀린다.
         */
        className="absolute right-[18px] bottom-hud-b z-[21] flex w-right-panel items-stretch max-tablet:right-0 max-tablet:bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom,0px))] max-tablet:left-0 max-tablet:w-auto"
      >
        <PlayerBar />
      </footer>
    </>
  );
}
