import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useMapStore } from "./use-map-store";

/** 재생 컨텍스트. 플리와 여정은 동시에 있을 수 없다 — 하나 켜지면 하나 꺼진다 */
export type PlayContext =
  | { kind: "single" }
  | { kind: "playlist"; playlistId: number }
  | { kind: "journey"; startMusicId: number; endMusicId: number };

interface PlayerState {
  currentMusicId: number | null;
  isPlaying: boolean;
  context: PlayContext;
  /** 순차재생 큐 (플리/여정). single이면 빈 배열 */
  queue: number[];
  queueIndex: number;

  playSingle: (musicId: number) => void;
  playQueue: (context: Exclude<PlayContext, { kind: "single" }>, musicIds: number[], startIndex?: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  devtools(
    (set, get) => ({
      currentMusicId: null,
      isPlaying: false,
      context: { kind: "single" },
      queue: [],
      queueIndex: 0,

      playSingle: (musicId) => {
        // ACT-01: 별자리(여정·플리) 밖의 곡을 재생하면 그 목록을 벗어난 것이므로 별자리가 사라진다
        const map = useMapStore.getState();
        if (map.constellationMusicIds.length && !map.constellationMusicIds.includes(musicId)) map.clearConstellation();
        set({ currentMusicId: musicId, isPlaying: true, context: { kind: "single" }, queue: [], queueIndex: 0 }, false, "playSingle");
      },

      playQueue: (context, musicIds, startIndex = 0) => {
        if (musicIds.length === 0) return;
        set(
          {
            context,
            queue: musicIds,
            queueIndex: startIndex,
            currentMusicId: musicIds[startIndex],
            isPlaying: true,
          },
          false,
          "playQueue",
        );
      },

      toggle: () => set((s) => ({ isPlaying: s.currentMusicId ? !s.isPlaying : false }), false, "toggle"),
      pause: () => set({ isPlaying: false }, false, "pause"),

      next: () => {
        const { queue, queueIndex } = get();
        if (queueIndex + 1 >= queue.length) return;
        set({ queueIndex: queueIndex + 1, currentMusicId: queue[queueIndex + 1] }, false, "next");
      },

      prev: () => {
        const { queue, queueIndex } = get();
        if (queueIndex - 1 < 0) return;
        set({ queueIndex: queueIndex - 1, currentMusicId: queue[queueIndex - 1] }, false, "prev");
      },

      stop: () =>
        set({ currentMusicId: null, isPlaying: false, context: { kind: "single" }, queue: [], queueIndex: 0 }, false, "stop"),
    }),
    { name: "player-store" },
  ),
);
