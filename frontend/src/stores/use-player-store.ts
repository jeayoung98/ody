import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import { samePlayContext } from "@/lib/play-context";
import { removeStorage, writeStorage } from "@/lib/storage";
import { runPlaybackTransition, useBlockingStore } from "./use-blocking-store";
import { useMapStore } from "./use-map-store";

export type PlayContext =
  | { kind: "single" }
  | { kind: "playlist"; playlistId: number }
  | { kind: "journey"; startMusicId: number; endMusicId: number }
  | { kind: "nearby"; centerMusicId: number };

interface PlayerState {
  currentMusicId: number | null;
  /** Requested playback. Actual audible playback is reported by the transport. */
  isPlaying: boolean;
  context: PlayContext;
  queue: number[];
  queueIndex: number;
  /** Transport generation; also changes when restarting the same song. */
  playSeq: number;
  restoreLast: (musicId: number) => void;
  playSingle: (musicId: number, origin?: PlayContext) => void;
  playQueue: (context: Exclude<PlayContext, { kind: "single" }>, musicIds: number[], startIndex?: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  detachContext: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  devtools((set, get) => ({
    currentMusicId: null, isPlaying: false, context: { kind: "single" },
    queue: [], queueIndex: 0, playSeq: 0,
    restoreLast: (musicId) => {
      if (get().currentMusicId == null) set({ currentMusicId: musicId, isPlaying: false }, false, "restoreLast");
    },
    playSingle: (musicId, origin) => {
      const current = get();
      const sameContext = !origin || samePlayContext(origin, current.context);
      if (current.currentMusicId === musicId && sameContext) {
        if (!useBlockingStore.getState().busy) set({ isPlaying: true }, false, "resume");
        return;
      }
      // Snapshot the destination. Later view changes cannot retarget it.
      const map = useMapStore.getState();
      const atQueue = sameContext ? current.queue.indexOf(musicId) : -1;
      const atList = map.constellationMusicIds.indexOf(musicId);
      const visibleList = atList >= 0 && map.constellationSource
        && (!origin || samePlayContext(origin, map.constellationSource));
      const fromList = Boolean(visibleList && (origin || current.context.kind === "single"));
      const context = atQueue >= 0 ? current.context : fromList ? map.constellationSource! : origin ?? { kind: "single" } as const;
      const queue = atQueue >= 0 ? current.queue : fromList ? [...map.constellationMusicIds] : [];
      const queueIndex = atQueue >= 0 ? atQueue : fromList ? atList : 0;
      runPlaybackTransition(() => {
        if (map.constellationMusicIds.length && !map.constellationMusicIds.includes(musicId)) useMapStore.getState().clearConstellation();
        set({ currentMusicId: musicId, isPlaying: true, context, queue, queueIndex, playSeq: get().playSeq + 1 }, false, "playSingle");
      });
    },
    playQueue: (context, musicIds, startIndex = 0) => {
      if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= musicIds.length) return;
      const queue = [...musicIds];
      runPlaybackTransition(() => set({
        context, queue, queueIndex: startIndex, currentMusicId: queue[startIndex],
        isPlaying: true, playSeq: get().playSeq + 1,
      }, false, "playQueue"));
    },
    detachContext: () => set({ context: { kind: "single" }, queue: [], queueIndex: 0 }, false, "detachContext"),
    toggle: () => {
      if (!useBlockingStore.getState().busy) set((s) => ({ isPlaying: s.currentMusicId != null && !s.isPlaying }), false, "toggle");
    },
    pause: () => set({ isPlaying: false }, false, "pause"),
    // The last track also passes through interception, then stops normally.
    next: () => {
      const { queue, queueIndex } = get();
      runPlaybackTransition(() => {
        if (queueIndex + 1 >= queue.length) { get().pause(); return; }
        set({ queueIndex: queueIndex + 1, currentMusicId: queue[queueIndex + 1], isPlaying: true, playSeq: get().playSeq + 1 }, false, "next");
      });
    },
    prev: () => {
      const { queue, queueIndex } = get();
      if (queueIndex <= 0 || !queue.length) return;
      runPlaybackTransition(() => set({
        queueIndex: queueIndex - 1, currentMusicId: queue[queueIndex - 1], isPlaying: true, playSeq: get().playSeq + 1,
      }, false, "prev"));
    },
    stop: () => runPlaybackTransition(() => set({
      currentMusicId: null, isPlaying: false, context: { kind: "single" }, queue: [], queueIndex: 0, playSeq: get().playSeq + 1,
    }, false, "stop")),
  }), { name: "player-store" }),
);

let persistedMusicId: number | null = null;
usePlayerStore.subscribe((s) => {
  if (s.currentMusicId === persistedMusicId) return;
  persistedMusicId = s.currentMusicId;
  if (s.currentMusicId == null) removeStorage(STORAGE_KEYS.playingMusicId);
  else writeStorage(STORAGE_KEYS.playingMusicId, s.currentMusicId);
});
