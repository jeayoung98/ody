"use client";

import type { CSSProperties } from "react";
import { usePanelEnabled } from "@/hooks/use-features";
import { SHEET_BOTTOM, SHEET_PEEK, useBottomSheet } from "@/hooks/use-bottom-sheet";
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
 * 아래로는 우하단 플레이어바(162px, 세로 3단 — S15P21A405-428) 위에서 끝난다: 72(위) + 18 + 162 + 12(틈) = 264. 위 72 = 상단 줄 16 + 44 + 틈 12 (S15P21A405-440).
 *
 * 왼쪽 가장자리 핸들로 접을 수 있다 (S15P21A405-318). 접으면 오른쪽으로 미끄러져 나가고
 * 핸들만 남는다 — **별자리는 그대로 켜져 있다.** 지도를 넓게 보려고 잠깐 치우는 동작이라
 * 패널을 닫는 것(별자리도 같이 꺼짐)과 다르다.
 */
export default function RightPanel() {
  const activePanel = usePanelStore((s) => s.activePanel);
  const collapsed = usePanelStore((s) => s.collapsed);
  const panelEnabled = usePanelEnabled();
  /**
   * 좁은 화면에서는 **아래에서 올라오는 시트**다 (S15P21A405-416). 375px 에서 이 패널은
   * 376px 이라 열리는 순간 지도를 64% 덮었고, 왼쪽 19px 이 화면 밖으로 잘려 제목도 안 보였다.
   * 별을 눌러 상세를 열면 다음 별을 찾을 수가 없어 "한 번 탭 = 상세, 두 번 = 재생" 이 끊겼다.
   *
   * `SHEET_BOTTOM` 은 아래에 이미 서 있는 것들(재생바·네비)의 높이다. 시트는 그 위에서만 움직인다.
   */
  const { sheetHeight, handlers, toggle } = useBottomSheet(SHEET_BOTTOM);
  if (!activePanel) return null;
  // 유저 테스트 동안 감춘 기능은 **프로그램으로 열려도** 그리지 않는다 (S15P21A405-333).
  // 레일에서만 막으면 플레이어바 컨텍스트·지도 클릭 같은 다른 길로 열려 버린다
  if (!panelEnabled[activePanel]) return null;

  return (
    <aside
      data-hud
      data-tutorial={`panel-${activePanel}`}
      className={`animate-tin absolute top-[72px] right-[18px] z-20 flex max-h-[calc(100dvh-264px)] w-right-panel flex-col transition-[translate] duration-500 ease-out ${
        /*
          접으면 **몸통을 조금 남기고** 들어간다 (S15P21A405-427). 싹 밀어 넣으면 거기에 무엇이
          있었는지가 안 읽힌다. 핸들은 그 바깥에 붙어 화면 안에 온전히 남는다.

          남기는 양과 미는 식을 **좌하단 계기판과 같게 맞췄다** (S15P21A405-477).
          계기판: `translate-x-[calc(-100%_+_10px)]` → 제 폭만큼 왼쪽으로 밀되 10px 을 덜 민다.
          여기: 그 거울인 `calc(100%_-_10px)`. 화면 끝에 남는 몸통이 양쪽 다 28px(여백 18 + 10)이다.
          숫자를 직접 적지 않고 `100%` 로 두는 편이 낫다 — 패널 폭이 바뀌어도 따라간다.

          **흐려지지 않는다** (S15P21A405-477). 예전에는 들어가면서 opacity 0.6 으로 옅어졌는데,
          opacity 는 자식이 부모보다 진해질 수 없어서 핸들까지 같이 흐려졌다 — 계기판 핸들은
          또렷한데 이쪽만 흐리니 같은 물건으로 안 보였다. 계기판이 자리만 옮기는 것처럼 여기도
          자리만 옮긴다.

          500ms 는 계기판의 300ms 보다 반 박자 느리다. 거리가 366px 로 계기판(220px)보다 길어서
          300ms 면 미끄러지는 게 아니라 튀어 들어간다 — 그래서 여기만 그대로 둔다.

          transition 대상이 `transform` 이 아니라 **`translate`** 인 것도 그냥 둔다 (S15P21A405-463).
          Tailwind v4 의 `translate-x-*` 는 transform 이 아니라 translate 프로퍼티에 값을 넣는다 —
          `transition-[transform,opacity]` 로 적으면 흐려지기만 하고 자리는 순간이동했다.
          계기판(`minimap-panel.tsx`)이 멀쩡했던 건 `transition-transform` 이 v4 에서
          transform·translate·scale·rotate 를 다 걸어 주기 때문이다.
        */
        collapsed ? "translate-x-[calc(100%_-_10px)]" : ""
      } max-tablet:top-auto max-tablet:right-gutter-sm max-tablet:bottom-[var(--sheet-bottom)] max-tablet:left-gutter-sm max-tablet:h-[var(--sheet-h)] max-tablet:w-auto max-tablet:max-h-none max-tablet:translate-x-0 max-tablet:overflow-hidden max-tablet:rounded-box`}
      /*
       * 높이를 **CSS 변수로만** 넘기고 쓰는 쪽은 `max-tablet:` 안이다 (S15P21A405-416).
       * `style={{height}}` 로 직접 박았더니, 좁은 화면에서 시트를 띄운 뒤 창을 넓혔을 때
       * 그 값이 그대로 남아 **데스크톱 패널이 120px 로 눌렸다.** 지우려고 `resize`·`matchMedia`
       * 를 들어 봤지만 **브라우저 기기 에뮬레이션에서는 두 이벤트가 오지 않는다**(실측).
       * 변수로 두면 768px 이상에서는 아무도 안 읽으므로 이벤트가 오든 말든 상관이 없다.
       */
      style={{ "--sheet-h": `${sheetHeight ?? SHEET_PEEK}px`, "--sheet-bottom": `${SHEET_BOTTOM}px` } as CSSProperties}
    >
      {/*
        시트 손잡이 (S15P21A405-416). **좁은 화면에서만 보인다.**
        요청자가 "접었다 폈다 되는 걸 알아보기 어렵다" 고 한 것이 우측 패널 손잡이(17px 반원)였다.
        여기는 **폭 전체 · 높이 44px** 로 두고 가운데에 막대를 그린다 — 눌러도 되고 끌어도 된다.
      */}
      <button
        type="button"
        aria-label={sheetHeight != null && sheetHeight > SHEET_PEEK ? "패널 접기" : "패널 펼치기"}
        onClick={toggle}
        {...handlers}
        className="hidden h-touch w-full shrink-0 touch-none place-items-center max-tablet:grid"
      >
        <span className="h-1 w-10 rounded-pill bg-white/30" />
      </button>
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
