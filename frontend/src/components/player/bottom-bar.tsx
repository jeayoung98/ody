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
         * 좁은 화면에서는 탭바와 **한 판**이다 (S15P21A405-417). 둘 다 화면 좌우 끝까지 붙고
         * 바닥에 깔린다 — 여백을 띄운 둥근 상자로 떠 있으니 화면 끝과의 사이에 지도 조각이
         * 남아 어정쩡했다.
         *
         * **둘 사이에 선을 긋지 않는다.** 유리가 불투명해진 뒤로는 가르는 줄이 한 판을 둘로
         * 쪼개 보이게만 했다. `-1px` 로 살짝 겹쳐 두면 틈도 선도 없이 이어진다.
         * 안전영역은 탭바가 제 패딩으로 이미 먹었다.
         */
        className="absolute right-[18px] bottom-hud-b z-[21] flex w-right-panel items-stretch max-tablet:right-0 max-tablet:bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom,0px)-1px)] max-tablet:left-0 max-tablet:w-auto"
      >
        <PlayerBar />
      </footer>
    </>
  );
}
