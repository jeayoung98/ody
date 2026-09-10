import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { PanelType } from "@/constants";

interface PanelState {
  /** 열려 있는 우측 패널. null이면 닫힘 */
  activePanel: PanelType | null;
  /** 곡 상세 대상 */
  musicId: number | null;
  /** 플레이리스트 패널 대상 */
  playlistId: number | null;
  /** 피드 대상 이메일. null이면 내 프로필 */
  profileEmail: string | null;

  openSong: (musicId: number) => void;
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

      openSong: (musicId) => set({ activePanel: "song", musicId }, false, "openSong"),
      openPlaylist: (playlistId) => set({ activePanel: "playlist", playlistId }, false, "openPlaylist"),
      openFeed: (email = null) => set({ activePanel: "feed", profileEmail: email }, false, "openFeed"),
      openJourney: () => set({ activePanel: "journey" }, false, "openJourney"),
      openFriends: () => set({ activePanel: "friends" }, false, "openFriends"),
      openChart: () => set({ activePanel: "chart" }, false, "openChart"),

      toggle: (panel) => {
        if (get().activePanel === panel) {
          set({ activePanel: null }, false, "toggle/close");
          return;
        }
        if (panel === "feed") set({ activePanel: "feed", profileEmail: null }, false, "toggle/feed");
        else set({ activePanel: panel }, false, `toggle/${panel}`);
      },

      close: () => set({ activePanel: null }, false, "close"),
    }),
    { name: "panel-store" },
  ),
);
