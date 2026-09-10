import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** 지도 클릭이 채울 칸. null 이면 지도 클릭은 평소대로 곡 상세만 연다 */
export type JourneyPickTarget = "start" | "end" | null;

interface JourneyState {
  /** 확장 검색(여정 만들기) 패널이 열려 있는지 */
  isComposerOpen: boolean;
  startMusicId: number | null;
  endMusicId: number | null;
  /** 다음 지도 클릭이 채울 칸 (출발 → 도착 → 다시 출발 순으로 번갈아) */
  pickTarget: JourneyPickTarget;
  /** "경로 만들기"를 눌러 확정된 상태. 이때만 경로를 조회하고 별자리를 바꾼다 */
  isRouteRequested: boolean;

  openComposer: () => void;
  closeComposer: () => void;
  setStart: (musicId: number | null) => void;
  setEnd: (musicId: number | null) => void;
  /** 지금 차례인 칸에 채우고 다음 칸으로 넘긴다 (지도 클릭·번갈아 채우기) */
  pickForNext: (musicId: number) => void;
  setPickTarget: (target: JourneyPickTarget) => void;
  swap: () => void;
  requestRoute: () => void;
  reset: () => void;
}

export const useJourneyStore = create<JourneyState>()(
  devtools(
    (set, get) => ({
      isComposerOpen: false,
      startMusicId: null,
      endMusicId: null,
      pickTarget: null,
      isRouteRequested: false,

      openComposer: () => set({ isComposerOpen: true, pickTarget: get().startMusicId == null ? "start" : "end" }, false, "openComposer"),
      closeComposer: () => set({ isComposerOpen: false, pickTarget: null }, false, "closeComposer"),

      // 지점을 바꾸면 이전 경로 확정은 풀린다. 다시 "경로 만들기"를 눌러야 적용된다
      setStart: (startMusicId) => set({ startMusicId, isRouteRequested: false, pickTarget: "end" }, false, "setStart"),
      setEnd: (endMusicId) => set({ endMusicId, isRouteRequested: false, pickTarget: "start" }, false, "setEnd"),

      pickForNext: (musicId) => {
        const { pickTarget } = get();
        if (pickTarget === "end") set({ endMusicId: musicId, isRouteRequested: false, pickTarget: "start" }, false, "pickForNext/end");
        else set({ startMusicId: musicId, isRouteRequested: false, pickTarget: "end" }, false, "pickForNext/start");
      },

      setPickTarget: (pickTarget) => set({ pickTarget }, false, "setPickTarget"),
      swap: () => set((s) => ({ startMusicId: s.endMusicId, endMusicId: s.startMusicId, isRouteRequested: false }), false, "swap"),
      requestRoute: () => set({ isRouteRequested: true, isComposerOpen: false, pickTarget: null }, false, "requestRoute"),
      reset: () => set({ startMusicId: null, endMusicId: null, isRouteRequested: false, pickTarget: null }, false, "reset"),
    }),
    { name: "journey-store" },
  ),
);
