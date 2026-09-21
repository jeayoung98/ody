import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PanelType } from "@/constants";
import { useJourneyStore } from "./use-journey-store";
import { useMapStore } from "./use-map-store";

/**
 * 패널이 닫히면 **그 패널에 딸린 지도 뷰도 같이 닫는다** (S15P21A405-316 · 336).
 *
 * 별자리는 여정·플리에, 주변 탐색 고리는 그 곡 상세에 딸린 화면이다. 패널 없이 지도만 가린 채
 * 남으면 나가는 길이 안 보인다 — 여정·주변 탐색·플리 세 흐름의 UX 를 같게 맞춘다.
 * 예전에는 별자리만 내려서, 주변 탐색 중에 패널을 닫으면 고리가 그대로 남았다.
 *
 * **목록은 지우지 않는다.** 플레이어바나 칩으로 언제든 다시 켤 수 있어야 한다.
 */
function hideMapView() {
  const map = useMapStore.getState();
  map.hideConstellationView();
  if (map.viewMode === "nearby") map.exitNearby();
}

/**
 * 패널을 **갈아탈 때** 그 패널과 상관없는 지도 뷰를 내린다 (S15P21A405-348).
 *
 * `hideMapView` 는 닫을 때만 불린다. 그래서 주변 탐색을 켜 둔 채 여정 패널을 열면 고리가
 * 지도에 그대로 남았다 — 여정과 아무 상관 없는 화면이 겹쳐 보이고, 끄려면 그 곡 상세로
 * 되돌아가야 했다. 뷰가 어느 패널에 딸린 것인지는 아래 두 줄이 전부다.
 *
 * **곡 상세는 둘 다의 예외다.** 주변 탐색 중 이웃을 누르면 그 이웃의 상세가 열리고,
 * 여정 목록에서 곡을 눌러도 상세로 들어간다 — 둘 다 그 화면을 떠나는 동작이 아니다.
 */
function syncMapView(next: PanelType) {
  const map = useMapStore.getState();
  if (next !== "song" && map.viewMode === "nearby") map.exitNearby();
  if (next !== "song" && next !== "journey" && next !== "playlist") map.hideConstellationView();
}

/**
 * 여정 확장 검색창을 내린다 (S15P21A405-390).
 *
 * **검색창과 사이드 패널은 함께 뜨지 않는다** (JOURNEY-01). 반대 방향은 이미 막혀 있었는데
 * (`use-open-journey-composer` 가 패널을 먼저 닫는다) 이쪽만 빠져 있었다 — 검색창을 열어 둔 채
 * 레일에서 차트를 누르면 둘이 겹쳐 떴다.
 *
 * 레일에서만 막지 않는 이유는 패널을 여는 길이 레일 말고도 있기 때문이다 — 지도에서 별을
 * 누르거나 플레이어바에서 들어와도 같은 규칙을 따라야 한다.
 */
function hideComposer() {
  if (useJourneyStore.getState().isComposerOpen) useJourneyStore.getState().closeComposer();
}

/** 패널을 여는 모든 길이 거쳐 간다 — 한 군데라도 빠지면 지도 뷰가 어긋난 채 남는다 */
const open = (panel: PanelType, patch: object = {}) => {
  syncMapView(panel);
  hideComposer();
  return { activePanel: panel, back: null, collapsed: false, ...patch } as const;
};

/**
 * 곡 상세에서 **돌아갈 자리**. 여정·플리 목록에서 곡을 눌러 들어왔거나, 주변 음악 카드로
 * 이웃에 들어왔을 때 잡힌다 (S15P21A405-384) — 지도에서 바로 연 곡 상세에는 돌아갈 자리가 없다.
 *
 * **한 겹만 기억한다.** 카드를 타고 계속 들어가도 쌓지 않는다 — 돌아가는 곳은 늘 "직전 곡" 이고,
 * 더 거슬러 올라가는 길은 지도가 대신한다.
 */
export type PanelReturn = { panel: "journey" } | { panel: "playlist"; playlistId: number } | { panel: "song"; musicId: number } | { panel: "friends" };

interface PanelState {
  /** 열려 있는 우측 패널. null이면 닫힘 */
  activePanel: PanelType | null;
  /** 곡 상세 대상 */
  musicId: number | null;
  /** 플레이리스트 패널 대상 */
  playlistId: number | null;
  /** 피드 대상 이메일. null이면 내 프로필 */
  profileEmail: string | null;
  /** 뒤로가기로 돌아갈 자리. null이면 뒤로가기를 그리지 않는다 */
  back: PanelReturn | null;
  /**
   * 패널이 접혀 있는가 (S15P21A405-318).
   *
   * **닫기와 다르다.** 닫으면 패널도 별자리도 사라지지만, 접으면 둘 다 살아 있고 패널만
   * 화면 밖으로 미끄러진다 — 별자리를 넓게 보려고 잠깐 치우는 동작이다.
   * 지도 가림 폭도 이 값을 따라간다 (`main-screen.tsx`).
   */
  collapsed: boolean;

  openSong: (musicId: number) => void;
  /**
   * 지도에서 별을 눌러 곡 상세로 들어간다 (S15P21A405-515).
   *
   * **주변 사람을 펼쳐 놓고 있으면 패널을 갈아타지 않는다.** 주변 사람은 내가 듣는 곡 기준으로
   * 도는 화면이라, 곡을 바꿔 가며 레이더가 어떻게 변하는지 보는 것이 그 화면을 쓰는 방식이다.
   * 누를 때마다 상세로 튕기면 그 동작 자체가 불가능하다. 선택·재생은 그대로 일어나므로
   * 누른 것이 씹히지도 않는다 — 두 번째 누름이 재생이고, 그러면 레이더가 그 곡으로 다시 그려진다.
   *
   * 지도 클릭에만 건다. 검색·플레이어바·내 위치로 가기처럼 **"이 곡으로 가자" 는 명시적 지시**는
   * 막지 않는다 — 그건 사용자가 화면을 옮기겠다고 말한 것이다.
   */
  openSongFromMap: (musicId: number) => void;
  /** 지금 열린 목록(여정·플리)에서 곡 상세로 들어간다 — 돌아갈 자리를 기억한다 */
  openSongFromList: (musicId: number) => void;
  /** 주변 음악 카드로 이웃 곡에 들어간다 — 직전 곡을 돌아갈 자리로 기억한다 (S15P21A405-384) */
  openNeighborSong: (musicId: number, fromMusicId: number) => void;
  /** 기억해 둔 자리로 돌아간다 */
  goBack: () => void;
  openPlaylist: (playlistId: number) => void;
  openFeed: (email?: string | null) => void;
  openJourney: () => void;
  openFriends: () => void;
  openChart: () => void;
  /** 네비바 토글: 같은 패널이면 닫고, 다르면 연다 */
  toggle: (panel: PanelType) => void;
  close: () => void;
  /** 패널을 접었다 폈다 (S15P21A405-318). 별자리·패널 종류는 건드리지 않는다 */
  toggleCollapsed: () => void;
  /**
   * 자리를 비켜 준다 (S15P21A405-404). 지도를 움직이는 동안 불린다.
   * **닫는 게 아니다** — 별자리·주변 탐색은 살아 있고 패널만 화면 밖으로 미끄러진다.
   */
  collapse: () => void;
}

export const usePanelStore = create<PanelState>()(
  devtools(
    (set, get) => ({
      activePanel: null,
      musicId: null,
      playlistId: null,
      profileEmail: null,
      back: null,
      collapsed: false,

      openSong: (musicId) => set(open("song", { musicId }), false, "openSong"),

      openSongFromMap: (musicId) => {
        const { activePanel, collapsed } = get();
        if (activePanel === "friends") {
          // 펼쳐 있으면 고정 — 레이더를 보면서 곡만 바꾼다
          if (!collapsed) return;
          // 접어 뒀으면 보여 줄 것이 없으니 상세를 연다. 대신 돌아갈 자리를 남긴다 —
          // 접기는 "잠깐 치우기" 라서, 상세를 열고 끝나면 레이더가 통째로 사라진 셈이 된다
          set(open("song", { musicId, back: { panel: "friends" } }), false, "openSongFromMap/fromFriends");
          return;
        }
        set(open("song", { musicId }), false, "openSongFromMap");
      },

      openSongFromList: (musicId) => {
        const { activePanel, playlistId } = get();
        const back: PanelReturn | null =
          activePanel === "journey" ? { panel: "journey" } : activePanel === "playlist" && playlistId != null ? { panel: "playlist", playlistId } : null;
        set(open("song", { musicId, back }), false, "openSongFromList");
      },

      openNeighborSong: (musicId, fromMusicId) =>
        set(open("song", { musicId, back: { panel: "song", musicId: fromMusicId } }), false, "openNeighborSong"),

      goBack: () => {
        const back = get().back;
        if (!back) return;
        if (back.panel === "journey") set({ activePanel: "journey", back: null, collapsed: false }, false, "goBack/journey");
        else if (back.panel === "friends") set({ activePanel: "friends", back: null, collapsed: false }, false, "goBack/friends");
        else if (back.panel === "song") set({ activePanel: "song", musicId: back.musicId, back: null, collapsed: false }, false, "goBack/song");
        else set({ activePanel: "playlist", playlistId: back.playlistId, back: null, collapsed: false }, false, "goBack/playlist");
      },

      openPlaylist: (playlistId) => set(open("playlist", { playlistId }), false, "openPlaylist"),
      openFeed: (email = null) => set(open("feed", { profileEmail: email }), false, "openFeed"),
      openJourney: () => set(open("journey"), false, "openJourney"),
      openFriends: () => set(open("friends"), false, "openFriends"),
      openChart: () => set(open("chart"), false, "openChart"),

      toggle: (panel) => {
        if (get().activePanel === panel) {
          hideMapView();
          set({ activePanel: null, back: null }, false, "toggle/close");
          return;
        }
        if (panel === "feed") set(open("feed", { profileEmail: null }), false, "toggle/feed");
        else set(open(panel), false, `toggle/${panel}`);
      },

      close: () => {
        hideMapView();
        set({ activePanel: null, back: null, collapsed: false }, false, "close");
      },

      /** 접기는 닫기가 아니다 — 별자리도 열린 패널도 그대로 두고 자리만 비켜 준다 */
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed }), false, "toggleCollapsed"),

      /**
       * 드래그 중에 매 프레임 불릴 수 있다. **바뀔 때만 set 한다** — 같은 값을 계속 넣으면
       * 구독자가 매번 깨어나고, 그 끝에 지도 가림폭 계산이 달려 있어 드래그가 무거워진다.
       */
      collapse: () =>
        /**
         * **주변 사람은 비켜 주지 않는다** (S15P21A405-515). 지도를 끄는 동안 자리를 비우는 것은
         * 지도를 보려는 사람에게 맞는 동작인데, 주변 사람은 지도를 움직이며 **같이** 보는 화면이다.
         * 조금만 끌어도 접히면 레이더가 계속 사라진다. 접기 버튼은 그대로 도므로 치우고 싶으면 치운다.
         */
        set((s) => (s.activePanel && s.activePanel !== "friends" && !s.collapsed ? { collapsed: true } : {}), false, "collapse"),
    }),
    { name: "panel-store" },
  ),
);
