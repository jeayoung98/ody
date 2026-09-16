import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants";
import { removeStorage, writeStorage } from "@/lib/storage";
import { heldBack, useBlockingStore } from "./use-blocking-store";
import { useMapStore } from "./use-map-store";

/**
 * 재생 컨텍스트. 플리와 여정은 동시에 있을 수 없다 — 하나 켜지면 하나 꺼진다.
 *
 * **주변 탐색을 `playlist` 로 만들면 안 된다** (S15P21A405-359). 설문이 플리를 일부러
 * 빼고 보기 때문에(`survey-runner` 의 `inNearby`), 플리인 척하면 주변 탐색 설문이 영영
 * 안 뜬다 — 플리는 사용자가 임의로 담은 목록이라 우리 추천 결과가 아니라서 뺀 것이고,
 * 주변 10곡은 정확히 그 반대다. 그래서 제 kind 를 따로 둔다.
 */
export type PlayContext =
  | { kind: "single" }
  | { kind: "playlist"; playlistId: number }
  | { kind: "journey"; startMusicId: number; endMusicId: number }
  | { kind: "nearby"; centerMusicId: number };

interface PlayerState {
  currentMusicId: number | null;
  isPlaying: boolean;
  context: PlayContext;
  /** 순차재생 큐 (플리/여정). single이면 빈 배열 */
  queue: number[];
  queueIndex: number;
  /**
   * 재생을 **새로 시작할 때마다 올라가는 번호** (S15P21A405-338).
   *
   * 같은 곡으로 시작하는 다른 여정을 틀면 `currentMusicId` 도 `isPlaying` 도 그대로라
   * 임베드가 변화를 못 보고 이전 재생 위치에 머물렀다. 이 번호가 바뀌면 같은 영상이어도
   * 처음부터 다시 건다.
   */
  playSeq: number;

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
  /** 목록에서 떨어져 나와 지금 곡만 남긴다. 소리는 끊지 않는다 (S15P21A405-338) */
  detachContext: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  devtools(
    (set, get) => ({
      currentMusicId: null,
      isPlaying: false,
      context: { kind: "single" },
      queue: [],
      queueIndex: 0,
      playSeq: 0,

      restoreLast: (musicId) => {
        if (get().currentMusicId != null) return;
        set({ currentMusicId: musicId, isPlaying: false }, false, "restoreLast");
      },

      /**
       * 곡 하나를 재생한다.
       *
       * **목록 안의 곡이면 목록을 버리지 않는다.** 여정·플리를 듣던 중에 그 안의 곡을 지도나
       * 목록에서 눌렀을 때, 예전에는 큐를 비우고 단일 재생으로 떨어뜨렸다. 그러면 이전·다음
       * 버튼이 죽고 "여정 재생 중" 표시도 사라져서, 사용자가 보기엔 멀쩡한 곡 하나 눌렀을 뿐인데
       * 여정이 통째로 끊긴 것처럼 보였다.
       */
      playSingle: (musicId) => {
        /**
         * 지금 듣던 곡을 떠나기 전에 물을 것이 있으면 **여기서 멈춘다** (S15P21A405-335).
         * 끼어든 쪽이 볼일을 마치면 아래 클로저가 그대로 다시 불려 정상 통과한다 —
         * 그때는 물을 것이 없어져 `heldBack` 이 false 다.
         */
        if (heldBack(() => get().playSingle(musicId))) return;

        // 1. 지금 듣는 큐 안의 곡 — 자리만 옮긴다
        const { queue } = get();
        const atQueue = queue.indexOf(musicId);
        if (atQueue >= 0) {
          set({ currentMusicId: musicId, queueIndex: atQueue, isPlaying: true }, false, "playSingle/inQueue");
          return;
        }

        const map = useMapStore.getState();

        /**
         * 2. 만들어만 두고 아직 안 듣던 여정·플리 안의 곡 — 그 자리부터 그 목록을 듣는다.
         *
         * **다른 활동이 돌고 있으면 여기로 오지 않는다** (`context.kind === "single"` 조건).
         * 플리를 듣는 중에 여정 별을 누르면 활동이 바뀌는 것이라 "멈추고 시작할까요?" 를
         * 먼저 물어야 하는데(ACT-01), 스토어에서는 물어볼 수가 없다. 그 경우는 3번으로 내려보낸다.
         */
        const atList = map.constellationMusicIds.indexOf(musicId);
        if (atList >= 0 && map.constellationSource && get().context.kind === "single") {
          set(
            {
              currentMusicId: musicId,
              isPlaying: true,
              context: map.constellationSource,
              queue: map.constellationMusicIds,
              queueIndex: atList,
            },
            false,
            "playSingle/inList",
          );
          return;
        }

        // 3. ACT-01: 별자리(여정·플리) 밖의 곡을 재생하면 그 목록을 벗어난 것이므로 별자리가 사라진다
        if (map.constellationMusicIds.length && !map.constellationMusicIds.includes(musicId)) map.clearConstellation();
        set({ currentMusicId: musicId, isPlaying: true, context: { kind: "single" }, queue: [], queueIndex: 0 }, false, "playSingle");
      },

      playQueue: (context, musicIds, startIndex = 0) => {
        if (musicIds.length === 0) return;
        // 목록 재생도 지금 곡을 떠나는 일이다 — 주변 탐색 중에 여정을 트는 경우가 여기다
        if (heldBack(() => get().playQueue(context, musicIds, startIndex))) return;
        set(
          {
            context,
            queue: musicIds,
            queueIndex: startIndex,
            currentMusicId: musicIds[startIndex],
            isPlaying: true,
            playSeq: get().playSeq + 1,
          },
          false,
          "playQueue",
        );
      },

      /**
       * 목록에서 떨어져 나와 **지금 곡만** 남긴다 (S15P21A405-338).
       *
       * 경로 지우기처럼 목록이 사라지는 자리에서 쓴다. `stop()` 과 달리 **소리를 끊지 않는다** —
       * 듣던 곡은 계속 들리고 맥락만 단독으로 내려온다. 이걸 안 하면 `context` 가 여정으로 남아
       * 플레이어바를 누르는 순간 지운 경로가 되살아난다.
       */
      detachContext: () => set({ context: { kind: "single" }, queue: [], queueIndex: 0 }, false, "detachContext"),

      toggle: () => set((s) => ({ isPlaying: s.currentMusicId ? !s.isPlaying : false }), false, "toggle"),
      pause: () => set({ isPlaying: false }, false, "pause"),

      next: () => {
        /**
         * **큐 끝 검사보다 먼저 묻는다** (S15P21A405-335).
         *
         * 여기는 넘기는 길이 전부 지난다 — 임베드의 `ended` (S15P21A405-308), ⏭ 버튼.
         * 그중 `ended` 는 **단일 재생에서도 온다.** 큐 끝을 먼저 보고 나가 버리면 곡이 끝나
         * 멈춘 자리에서 아무 일도 안 일어나고, 사용자가 한참 딴 데를 돌다 다른 곡을 누를 때가
         * 되어서야 설문이 뜬다. 다 들은 그 자리에서 묻는 편이 기억이 선명하다.
         */
        if (heldBack(() => get().next())) return;
        const { queue, queueIndex } = get();
        if (queueIndex + 1 >= queue.length) return;
        set({ queueIndex: queueIndex + 1, currentMusicId: queue[queueIndex + 1] }, false, "next");
      },

      prev: () => {
        const { queue, queueIndex } = get();
        if (queueIndex - 1 < 0) return;
        /**
         * 막는 창이 떠 있으면 **그냥 무시한다** (S15P21A405-258).
         *
         * next 처럼 예약하지 않는다 — 이건 사람이 버튼을 누를 때만 불리므로, 놓쳐도 답한 뒤
         * 다시 누르면 된다. 예약해 두면 제출하는 순간 갑자기 뒤로 가버려서 더 이상하다.
         *
         * 지금은 카드가 화면을 덮어 버튼을 누를 수 없지만, 그 불변식이 CSS 에만 걸려 있다.
         * 카드 모양을 바꾸는 순간 뚫리므로 여기서 코드로 막는다.
         */
        if (useBlockingStore.getState().busy) return;
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
