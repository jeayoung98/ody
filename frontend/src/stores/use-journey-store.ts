import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** 지도 클릭이 채울 칸. null 이면 지도 클릭은 평소대로 곡 상세만 연다 */
export type JourneyPickTarget = "start" | "end" | null;

interface JourneyState {
  /** 확장 검색(여정 만들기) 패널이 열려 있는지 */
  isComposerOpen: boolean;
  startMusicId: number | null;
  endMusicId: number | null;
  /**
   * 다음 지도 클릭이 채울 칸. 처음엔 출발 → 도착 순으로 채워지고, **그 뒤로는 도착에 머문다**
   * (S15P21A405-337). 출발을 바꾸려면 출발 칸을 눌러 포커스한다 — {@link pickForNext} 참고.
   */
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

      /**
       * 지점을 바꾸면 이전 경로 확정은 풀린다. 다시 "경로 만들기"를 눌러야 적용된다.
       *
       * **채운 뒤 차례는 도착에 머문다** (S15P21A405-337). 예전에는 `setEnd` 가 차례를 출발로
       * 되돌려서, 도착 칸을 눌러 둔 채 다른 곡을 고르면 엉뚱하게 출발이 바뀌었다.
       * 출발을 고치는 길은 출발 칸을 눌러 포커스하는 것 하나로 둔다.
       */
      /**
       * **출발을 비우면 차례는 출발이다** (S15P21A405-661). 비운 뒤에도 도착에 머물면 지도에서 별을 눌렀을 때
       * 방금 비운 출발이 아니라 도착이 갈아 끼워진다 — 비웠다는 것은 다시 고르겠다는 뜻이다.
       */
      setStart: (startMusicId) => set({ startMusicId, isRouteRequested: false, pickTarget: startMusicId == null ? "start" : "end" }, false, "setStart"),
      setEnd: (endMusicId) => set({ endMusicId, isRouteRequested: false, pickTarget: "end" }, false, "setEnd"),

      /**
       * 지도 클릭이 채울 칸 (S15P21A405-337).
       *
       * 1. 사용자가 직접 눌러 **포커스한 칸이 있으면 그 칸** — 눈이 가 있는 곳이 바뀌어야 한다
       * 2. 없고 출발이 비었으면 출발
       * 3. 그 밖에는 **계속 도착** — 둘 다 채운 뒤에는 도착을 갈아 끼우며 경로를 고르는 동작이다
       */
      pickForNext: (musicId) => {
        const { pickTarget, startMusicId } = get();
        const target = pickTarget ?? (startMusicId == null ? "start" : "end");
        if (target === "end") set({ endMusicId: musicId, isRouteRequested: false, pickTarget: "end" }, false, "pickForNext/end");
        // 출발을 막 채웠으면 다음 차례는 도착이다 — 빈 상태에서 시작하면 출발 → 도착 순으로 채워진다
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
