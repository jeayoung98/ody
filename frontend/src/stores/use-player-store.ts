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
  /**
   * **서버에 알려야 하는 재생**이 몇 번째인가 (S15P21A405-569).
   *
   * `playSeq` 와 따로 두는 이유는 그 값이 세는 것이 다르기 때문이다. `playSeq` 는 "플레이어가
   * 새 곡을 세웠다" 라서 `preview`(설문 창 다시 듣기)와 `stop` 도 올린다 — 둘 다 서버에
   * 알릴 일이 아니다. 다시 듣기로 내 지도 위치가 움직이면 안 되고, 정지는 곡이 없다.
   *
   * 올리는 것은 넷뿐이다: `playSingle` · `playQueue` · `next` · `prev`.
   */
  declareSeq: number;
  restoreLast: (musicId: number) => void;
  playSingle: (musicId: number, origin?: PlayContext) => void;
  playQueue: (context: Exclude<PlayContext, { kind: "single" }>, musicIds: number[], startIndex?: number) => void;
  /** 답을 강제하는 창 안에서 곡을 다시 들려준다. 큐·맥락·자리는 그대로 두고 울리는 곡만 바꾼다 */
  preview: (musicId: number) => void;
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
    queue: [], queueIndex: 0, playSeq: 0, declareSeq: 0,
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
        set({ currentMusicId: musicId, isPlaying: true, context, queue, queueIndex, playSeq: get().playSeq + 1, declareSeq: get().declareSeq + 1 }, false, "playSingle");
      });
    },
    playQueue: (context, musicIds, startIndex = 0) => {
      if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= musicIds.length) return;
      const queue = [...musicIds];
      runPlaybackTransition(() => set({
        context, queue, queueIndex: startIndex, currentMusicId: queue[startIndex],
        isPlaying: true, playSeq: get().playSeq + 1, declareSeq: get().declareSeq + 1,
      }, false, "playQueue"));
    },
    /**
     * **다시 들려주기** (S15P21A405-371). 설문 카드 안에서 기준곡·이전 정거장을 눌렀을 때 쓴다.
     *
     * `runPlaybackTransition` 을 지나지 않는다 — 카드가 떠 있는 동안 게이트는 "첫 목적지가
     * 이긴다" 로 새 재생을 통째로 삼키므로, 그 길로 가면 아무 소리도 안 난다. 여기서 바꾸는
     * 것은 **지금 울리는 곡뿐**이고 큐·맥락·자리는 그대로라, 답한 뒤 보류돼 있던 목적지로
     * 그대로 이어진다.
     */
    preview: (musicId) =>
      set((s) => (s.currentMusicId === musicId ? { isPlaying: true } : { currentMusicId: musicId, isPlaying: true, playSeq: s.playSeq + 1 }), false, "preview"),
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
        set({ queueIndex: queueIndex + 1, currentMusicId: queue[queueIndex + 1], isPlaying: true, playSeq: get().playSeq + 1, declareSeq: get().declareSeq + 1 }, false, "next");
      });
    },
    prev: () => {
      const { queue, queueIndex } = get();
      if (queueIndex <= 0 || !queue.length) return;
      runPlaybackTransition(() => set({
        queueIndex: queueIndex - 1, currentMusicId: queue[queueIndex - 1], isPlaying: true, playSeq: get().playSeq + 1, declareSeq: get().declareSeq + 1,
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
