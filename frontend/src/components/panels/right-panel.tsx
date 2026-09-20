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
 * 아래로는 우하단 플레이어바(162px, 세로 3단 — S15P21A405-428) 위에서 끝난다: 72(위) + 18 + 162 + 12(틈) = 264. 위 72 = 상단 줄 16 + 44 + 틈 12 (S15P21A405-440).
 *
  * **좁은 화면에서는 지도를 덮는 전체 화면이다** (S15P21A405-417). 375px 에서는 패널이 화면만큼
 * 넓어 어떻게 놓아도 지도를 가린다. 대신 **내가 열었을 때만 열린다** — 별을 탭하면 작은 카드가
 * 뜨고, 거기 `상세` 를 눌러야 여기로 온다. 안 시켰는데 덮이던 것이 문제였지 덮는 것 자체가 아니었다.
 *
 * 왼쪽 가장자리 핸들로 접을 수 있다 (S15P21A405-318). 접으면 오른쪽으로 미끄러져 나가고
 * 핸들만 남는다 — **별자리는 그대로 켜져 있다.** 지도를 넓게 보려고 잠깐 치우는 동작이라
 * 패널을 닫는 것(별자리도 같이 꺼짐)과 다르다.
 *
 * **접기는 폰에서 더 중요하다.** 여기서 패널은 화면을 통째로 덮으므로, 닫아 버리지 않고
 * 잠깐 치우는 길이 없으면 지도를 보려면 매번 닫았다 다시 열어야 한다. 그래서 폰에서는
 * `translate-x` 도 `overflow` 도 건드리지 않는다 — 접는 식은 데스크톱과 같은 것 하나뿐이고,
 * `overflow-hidden` 을 걸면 몸통 바깥(-17px)에 붙은 핸들이 잘려 **접을 길 자체가 사라진다.**
 *
 * 폰에서는 **떠 있는 카드가 아니라 화면 한 칸**이다 (S15P21A405-417). 하단이 고정 탭바가
 * 되면서 여기는 그 위를 채우는 내용 자리가 됐다 — 여백을 띄워 두면 프로필·곡 상세가
 * "지도 위에 떠서 가리는 것" 으로 읽힌다. 오른쪽은 화면 끝까지 붙이고, 왼쪽만 손잡이
 * 폭(17)만큼 비운다: 양쪽 다 0 으로 두면 손잡이가 `0 - 17 = -17` 로 화면 밖에 걸린다(실측).
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
      } max-tablet:right-0 max-tablet:left-handle-w max-tablet:bottom-[var(--nav-bottom)] max-tablet:w-auto max-tablet:max-h-none`}
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
