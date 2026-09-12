import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import { removeStorage, writeStorage } from "@/lib/storage";
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

  /**
   * 새로고침 복원 (S15P21A405-275). **소리는 다시 틀지 않는다** — 음원은 앱 밖에서 듣기 때문에
   * (규칙 6) 복원할 소리가 없다. 어떤 곡이었는지만 되살려 플레이어바에서 이어 들을 수 있게 한다.
   *
   * 스토어를 만들 때 localStorage 를 읽으면 **서버 렌더와 값이 달라 하이드레이션이 깨진다** —
   * 그래서 클라이언트가 붙은 뒤에 한 번 부른다.
   */
  restoreLast: (musicId: number) => void;
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

      restoreLast: (musicId) => {
        if (get().currentMusicId != null) return;
        set({ currentMusicId: musicId, isPlaying: false }, false, "restoreLast");
      },

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

/**
 * 재생 중인 곡을 localStorage 에 남긴다 (S15P21A405-275).
 *
 * 바뀌는 자리가 다섯 군데(playSingle·playQueue·next·prev·stop)라 각각에 넣으면 언젠가 하나를 빠뜨린다.
 * 여기서 한 번만 구독해 **바뀔 때만** 쓴다.
 */
let persistedMusicId: number | null = null;
usePlayerStore.subscribe((s) => {
  if (s.currentMusicId === persistedMusicId) return;
  persistedMusicId = s.currentMusicId;
  if (s.currentMusicId == null) removeStorage(STORAGE_KEYS.playingMusicId);
  else writeStorage(STORAGE_KEYS.playingMusicId, s.currentMusicId);
});
