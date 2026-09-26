import { create } from "zustand";
import { useFollowStore } from "./use-follow-store";
import { devtools } from "zustand/middleware";
import type { PanelType } from "@/constants";
import { pushHistory, snapshotOf, type FollowType, type PanelReturn } from "@/lib/panel-history";
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

/**
 * 패널을 여는 모든 길이 거쳐 간다 — 한 군데라도 빠지면 지도 뷰가 어긋난 채 남는다.
 * **새로 여는 것이라 스택을 비운다** (S15P21A405-659). 타고 들어가는 길은 {@link drill} 이다.
 */
const open = (panel: PanelType, patch: object = {}) => {
  syncMapView(panel);
  hideComposer();
  return { activePanel: panel, history: [] as PanelReturn[], feedFollows: null, snap: OPEN_SNAP, ...patch } as const;
};

/** 돌아갈 자리 하나를 패널 상태 조각으로 */
function patchOf(target: PanelReturn): object {
  switch (target.panel) {
    case "song":
      return { musicId: target.musicId };
    case "playlist":
      return { playlistId: target.playlistId };
    case "feed":
      return { profileEmail: target.profileEmail, feedFollows: target.follows ?? null };
    default:
      return {};
  }
}

/**
 * 돌아갈 자리 (S15P21A405-384 · 610 · 659). 정의는 `lib/panel-history` — 여기서는 이름만 다시 내보낸다.
 *
 * **이제 스택이다.** 예전에는 한 겹만 기억해서 카드를 타고 계속 들어가면 첫 자리로 못 돌아갔다.
 */
export type { FollowType, PanelReturn };

/**
 * 폰에서 시트가 설 수 있는 **세 자리** (S15P21A405-416). 숫자가 클수록 많이 올라온다.
 *
 * | 단 | 보이는 것 | 높이 |
 * | --- | --- | --- |
 * | 1 | 머리글과 곡 제목 줄 | `--spacing-sheet-s1` |
 * | 2 | 칩과 "출발점으로 · 도착점으로" 까지 | `--spacing-sheet-s2` |
 * | 3 | 전부 (지금까지의 "펼침") | 화면 높이 |
 *
 * 2 를 **여는 자리**로 둔다 — 곡이 무엇인지와 바로 할 수 있는 일까지는 보이되 지도도 절반쯤
 * 남는다. 지도를 덮어 버리면 다음 별을 못 찾는다는 것이 폰 배치의 출발점이었다.
 *
 * 세 자리 모두 **화면을 다 덮지는 않는다.** 덮으면 뒤로 가는 길을 따로 만들어야 하는데,
 * 지금 구조는 지도가 늘 뒤에 살아 있는 것을 전제로 서 있다.
 */
export type SheetSnap = 1 | 2 | 3;

/** 여는 자리. 위 표 참고 */
const OPEN_SNAP: SheetSnap = 2;

interface PanelState {
  /** 열려 있는 우측 패널. null이면 닫힘 */
  activePanel: PanelType | null;
  /** 곡 상세 대상 */
  musicId: number | null;
  /** 플레이리스트 패널 대상 */
  playlistId: number | null;
  /** 피드 대상 이메일. null이면 내 프로필 */
  profileEmail: string | null;
  /**
   * 타고 들어온 길 — 뒤로가기가 되돌아갈 자리들. 맨 뒤가 직전 자리다. 비어 있으면 뒤로가기를 그리지 않는다
   * (S15P21A405-659). 패널 안에서 눌러 연 것만 쌓이고, 레일·탭·지도·플레이어바·검색·닫기는 비운다
   */
  history: PanelReturn[];
  /** 프로필에서 팔로워·팔로잉 목록을 보는 중인가. `null` 이면 본문. 되돌아갈 때 목록까지 복원하려고 스토어에 둔다 */
  feedFollows: FollowType | null;
  /**
   * 시트가 어느 **단**에 있는가 (S15P21A405-416).
   *
   * **닫기와 다르다.** 닫으면 패널도 별자리도 사라지지만, 내리면 둘 다 살아 있고 패널만
   * 화면 밖으로 미끄러진다 — 별자리를 넓게 보려고 잠깐 치우는 동작이다.
   * 지도 가림 폭도 이 값을 따라간다 (`main-screen.tsx`).
   *
   * **데스크톱은 1 과 3 만 쓴다.** 거기서는 패널이 옆으로 접히는 두 상태뿐이라
   * `snap !== 1` 이면 전부 "펼침" 으로 그린다 — 그래서 여는 순간의 2 도 데스크톱에서는
   * 예전과 똑같이 펼쳐진 패널이다.
   */
  snap: SheetSnap;

  openSong: (musicId: number) => void;
  /**
   * 지도에서 별을 눌러 곡 상세로 들어간다.
   *
   * **어느 패널이 열려 있든 같다** (S15P21A405-547). 한때 주변 사람만 예외였다
   * (S15P21A405-515) — 펼쳐 놓고 있으면 패널을 안 갈아탔다. 레이더를 보면서 곡만 바꾸라는
   * 뜻이었는데, 예외가 하나만 있으니 같은 조작에 화면마다 다르게 반응해서 규칙이 안 읽혔다.
   *
   * 함수는 남겨 둔다 — 부르는 쪽이 "지도에서 눌렀다" 를 말하고 있고, 다시 갈라야 할 때
   * 여기 한 군데만 고치면 된다.
   */
  openSongFromMap: (musicId: number, snap?: SheetSnap) => void;
  /**
   * **타고 들어간다** (S15P21A405-659) — 지금 패널을 스택에 쌓고 `target` 을 연다. 패널 안에서 사람·플리·곡을
   * 눌렀을 때의 유일한 길이다. 레일·탭·지도에서 여는 것은 `open*` 이고 스택을 비운다
   */
  drill: (target: PanelReturn) => void;
  /** 지금 열린 목록(여정·플리)에서 곡 상세로 들어간다 — 3 단으로 연다 (`drill` + snap) */
  openSongFromList: (musicId: number) => void;
  /** 주변 음악 카드로 이웃 곡에 들어간다 — 직전 곡이 스택에 남는다 (S15P21A405-384) */
  openNeighborSong: (musicId: number) => void;
  /** 스택의 마지막 자리로 돌아간다. 돌아간 자리를 돌려준다 — 폰에서 탭 화면으로 옮겨야 할지는 부르는 쪽이 정한다 */
  goBack: () => PanelReturn | null;
  /** 프로필 안에서 팔로워·팔로잉 목록을 편다 / 접는다 */
  openFollows: (type: FollowType) => void;
  closeFollows: () => void;
  /**
   * 열려 있는 곡 상세를 **재생이 넘어간 곡으로** 갈아 끼운다 (S15P21A405-656). `openSong` 과 달리 돌아갈 자리·시트
   * 단을 그대로 둔다 — 순차 재생이 넘어갈 때마다 목록으로 돌아갈 길이 지워지면 안 된다. 곡 상세가 아니면 아무 일도 없다
   */
  followSong: (musicId: number) => void;
  openPlaylist: (playlistId: number) => void;
  /** 새로 연다 — 레일·탭·지도 표식. 패널 안에서 사람을 눌렀으면 `drill({ panel: "feed", ... })` 다 */
  openFeed: (email?: string | null) => void;
  openJourney: () => void;
  openFriends: () => void;
  openChart: () => void;
  /** 네비바 토글: 같은 패널이면 닫고, 다르면 연다 */
  toggle: (panel: PanelType) => void;
  close: () => void;
  /** 패널을 접었다 폈다 (S15P21A405-318). 데스크톱 손잡이 — 1 과 3 만 오간다 */
  toggleCollapsed: () => void;
  /**
   * 시트를 **한 단 올린다** (S15P21A405-416). 손잡이를 눌렀을 때.
   * 1→2→3 이고, 꼭대기에서 한 번 더 누르면 1 로 내려온다 — 그래야 손가락만으로 왕복이 된다.
   */
  raiseSnap: () => void;
  /**
   * 바깥을 눌렀을 때 (S15P21A405-416). **2·3 단은 1 단으로 내려오고, 1 단이면 닫는다.**
   * 예전에는 어느 단이든 바로 닫혔는데, 그러면 펼쳐 놓고 지도를 한 번 보려는 동작이
   * 매번 닫기가 된다.
   */
  lowerSnap: () => void;
  /** 드래그로 단을 직접 정한다 (S15P21A405-416) */
  setSnap: (snap: SheetSnap) => void;
  /**
   * 폰 시트의 2 단 높이를 **내용이 정할 때** 그 값(px). `null` 이면 기본값(`--spacing-sheet-s2`)이다.
   * 프로필이 팔로우·따라가기 버튼 아래에서 멈추려고 쓴다 (S15P21A405-703, `use-sheet-stop`).
   * 지도 가림폭이 이 값을 읽어 누른 사람을 시트 위 가운데로 둔다 (`main-screen`).
   */
  sheetStop: number | null;
  setSheetStop: (px: number | null) => void;
  /**
   * 폰 시트의 **1 단 높이를 내용이 정할 때** 그 값(px). `null` 이면 기본값(`--spacing-sheet-s1`)이다.
   * 곡 상세·프로필이 머리글을 접고 제목 줄 · 통계 줄 위까지만 걸리려고 쓴다 (S15P21A405-703, `use-sheet-peek`).
   */
  sheetPeek: number | null;
  setSheetPeek: (px: number | null) => void;
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
      history: [],
      feedFollows: null,
      snap: OPEN_SNAP,
      sheetStop: null,
      sheetPeek: null,

      openSong: (musicId) => set(open("song", { musicId }), false, "openSong"),
      followSong: (musicId) => set((s) => (s.activePanel === "song" && s.musicId !== musicId ? { musicId } : {}), false, "followSong"),

      /**
       * `snap` 을 주면 그 자리에 선다 (S15P21A405-593). **폰은 1 단으로 연다** — 별을 눌렀을 때
       * 알고 싶은 것은 "이게 무슨 곡이냐" 하나뿐이고, 지도는 그대로 보여야 다음 별을 고른다.
       * 부르는 쪽이 정하는 이유는 화면 폭을 아는 쪽이 거기이기 때문이다.
       */
      openSongFromMap: (musicId, snap) => set(open("song", snap ? { musicId, snap } : { musicId }), false, "openSongFromMap"),

      drill: (target) =>
        set(
          (s) => {
            const history = pushHistory(s.history, snapshotOf(s), target);
            /**
             * 곡은 **3 단으로 연다** (S15P21A405-593). 목록에서 곡을 골라 들어간 것은 그 곡을 지금
             * 보겠다는 뜻인데, 여는 자리(2 단)로 열면 시트가 도리어 **내려가면서** 상세가 떠서
             * 방금 누른 것이 작아지는 것처럼 보인다. 지도에서 별을 눌러 여는 길(2 단)과 다른 이유는
             * 그쪽은 지도를 보며 곡을 갈아 끼우는 동작이라 지도가 남아야 하기 때문이다.
             */
            const snap = target.panel === "song" ? { snap: 3 as SheetSnap } : {};
            return { ...open(target.panel, patchOf(target)), ...snap, history };
          },
          false,
          `drill/${target.panel}`,
        ),

      openSongFromList: (musicId) => get().drill({ panel: "song", musicId }),

      openNeighborSong: (musicId) => get().drill({ panel: "song", musicId }),

      goBack: () => {
        const history = get().history;
        const target = history[history.length - 1];
        if (!target) return null;
        syncMapView(target.panel);
        set({ activePanel: target.panel, ...patchOf(target), history: history.slice(0, -1), snap: OPEN_SNAP }, false, `goBack/${target.panel}`);
        return target;
      },

      openFollows: (type) => set((s) => (s.activePanel === "feed" ? { feedFollows: type } : {}), false, "openFollows"),
      closeFollows: () => set({ feedFollows: null }, false, "closeFollows"),

      openPlaylist: (playlistId) => set(open("playlist", { playlistId }), false, "openPlaylist"),
      openFeed: (email = null) => set(open("feed", { profileEmail: email }), false, "openFeed"),
      openJourney: () => set(open("journey"), false, "openJourney"),
      openFriends: () => set(open("friends"), false, "openFriends"),
      openChart: () => set(open("chart"), false, "openChart"),

      toggle: (panel) => {
        if (get().activePanel === panel) {
          hideMapView();
          set({ activePanel: null, history: [], feedFollows: null }, false, "toggle/close");
          return;
        }
        if (panel === "feed") set(open("feed", { profileEmail: null }), false, "toggle/feed");
        else set(open(panel), false, `toggle/${panel}`);
      },

      /**
       * **따라가는 중에는 닫히지 않고 1 단으로 내려온다** (S15P21A405-557).
       *
       * 따라가는 사람은 **곡을 직접 고를 수가 없다.** 상세를 없애 버리면 인솔자가 다음 조작을
       * 할 때까지 우측이 통째로 빈 화면이고, 스스로 다시 띄울 방법도 없다. 내려 두면 자리는
       * 비켜 주면서 인솔자가 곡을 옮길 때 그대로 되살아난다.
       *
       * 다른 패널(주변 사람·랭킹 등)을 닫을 때도 **내려간 상세로 돌아온다** — 그게 따라가는
       * 동안의 기본 화면이다.
       */
      close: () => {
        const ride = useFollowStore.getState();
        const riding = ride.leaderViewingMusicId ?? ride.leaderMusicId;
        if (ride.leaderEmail && riding != null) {
          syncMapView("song");
          set({ activePanel: "song", musicId: riding, history: [], feedFollows: null, snap: 1 }, false, "close/riding");
          return;
        }
        hideMapView();
        set({ activePanel: null, history: [], feedFollows: null, snap: OPEN_SNAP }, false, "close");
      },

      /** 접기는 닫기가 아니다 — 별자리도 열린 패널도 그대로 두고 자리만 비켜 준다 */
      toggleCollapsed: () => set((s) => ({ snap: s.snap === 1 ? 3 : 1 }) as const, false, "toggleCollapsed"),

      raiseSnap: () => set((s) => ({ snap: (s.snap === 3 ? 1 : s.snap + 1) as SheetSnap }), false, "raiseSnap"),

      /**
       * **한 단씩 내려온다** (S15P21A405-703, 사용자 결정). 3 단에서 지도를 누르면 1 단까지 곧장
       * 떨어져서, 펼쳐 둔 것을 잠깐 치우려다 제목 줄만 남았다. 3 → 2 → 1 → 닫힘이다.
       */
      lowerSnap: () => {
        const snap = get().snap;
        if (snap === 1) return void get().close();
        set({ snap: (snap - 1) as SheetSnap }, false, "lowerSnap");
      },

      setSnap: (snap) => set((s) => (s.snap === snap ? {} : { snap }), false, "setSnap"),
      setSheetStop: (px) => set((s) => (s.sheetStop === px ? {} : { sheetStop: px }), false, "setSheetStop"),
      setSheetPeek: (px) => set((s) => (s.sheetPeek === px ? {} : { sheetPeek: px }), false, "setSheetPeek"),

      /**
       * 드래그 중에 매 프레임 불릴 수 있다. **바뀔 때만 set 한다** — 같은 값을 계속 넣으면
       * 구독자가 매번 깨어나고, 그 끝에 지도 가림폭 계산이 달려 있어 드래그가 무거워진다.
       */
      collapse: () =>
        /**
         * **패널 종류를 가리지 않는다** (S15P21A405-547). S15P21A405-515 에서 주변 사람만
         * 예외로 뒀었다 — 지도를 움직이며 같이 보는 화면이라는 이유였다. 예외가 하나만 있으니
         * 같은 조작에 화면마다 다르게 반응해서 규칙이 안 읽혔고, 그래서 통일하기로 했다.
         */
        set((s) => (s.activePanel && s.snap !== 1 ? { snap: 1 as SheetSnap } : {}), false, "collapse"),
    }),
    { name: "panel-store" },
  ),
);
