import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PanelType } from "@/constants";
import { useMapStore } from "./use-map-store";

/**
 * 패널이 닫히면 별자리 뷰도 같이 닫는다 (S15P21A405-316).
 * 별자리는 패널에 딸린 화면이다 — 패널 없이 지도만 가린 채 남으면 나가는 길이 안 보인다.
 * **목록은 지우지 않는다.** 플레이어바나 칩으로 언제든 다시 켤 수 있어야 한다.
 */
function hideConstellation() {
  useMapStore.getState().hideConstellationView();
}

/**
 * 곡 상세에서 **돌아갈 자리**. 여정·플리 목록에서 곡을 눌러 들어왔을 때만 잡힌다 —
 * 지도에서 바로 연 곡 상세에는 돌아갈 자리가 없다.
 */
export type PanelReturn = { panel: "journey" } | { panel: "playlist"; playlistId: number };

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

  openSong: (musicId: number) => void;
  /** 지금 열린 목록(여정·플리)에서 곡 상세로 들어간다 — 돌아갈 자리를 기억한다 */
  openSongFromList: (musicId: number) => void;
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
}

export const usePanelStore = create<PanelState>()(
  devtools(
    (set, get) => ({
      activePanel: null,
      musicId: null,
      playlistId: null,
      profileEmail: null,
      back: null,

      openSong: (musicId) => set({ activePanel: "song", musicId, back: null }, false, "openSong"),

      openSongFromList: (musicId) => {
        const { activePanel, playlistId } = get();
        const back: PanelReturn | null =
          activePanel === "journey" ? { panel: "journey" } : activePanel === "playlist" && playlistId != null ? { panel: "playlist", playlistId } : null;
        set({ activePanel: "song", musicId, back }, false, "openSongFromList");
      },

      goBack: () => {
        const back = get().back;
        if (!back) return;
        if (back.panel === "journey") set({ activePanel: "journey", back: null }, false, "goBack/journey");
        else set({ activePanel: "playlist", playlistId: back.playlistId, back: null }, false, "goBack/playlist");
      },

      openPlaylist: (playlistId) => set({ activePanel: "playlist", playlistId, back: null }, false, "openPlaylist"),
      openFeed: (email = null) => set({ activePanel: "feed", profileEmail: email, back: null }, false, "openFeed"),
      openJourney: () => set({ activePanel: "journey", back: null }, false, "openJourney"),
      openFriends: () => set({ activePanel: "friends", back: null }, false, "openFriends"),
      openChart: () => set({ activePanel: "chart", back: null }, false, "openChart"),

      toggle: (panel) => {
        if (get().activePanel === panel) {
          hideConstellation();
          set({ activePanel: null, back: null }, false, "toggle/close");
          return;
        }
        if (panel === "feed") set({ activePanel: "feed", profileEmail: null, back: null }, false, "toggle/feed");
        else set({ activePanel: panel, back: null }, false, `toggle/${panel}`);
      },

      close: () => {
        hideConstellation();
        set({ activePanel: null, back: null }, false, "close");
      },
    }),
    { name: "panel-store" },
  ),
);
