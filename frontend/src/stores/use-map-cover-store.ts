import { create } from "zustand";

/**
 * 지도를 통째로 덮은 화면 수 (S15P21A405-737).
 *
 * 폰의 탭 화면(`panel-screen.tsx`)과 검색 화면(`search-screen.tsx`)은 지도 위에 화면 전체로 깔린다.
 * 그동안에도 지도 루프(`map-canvas.tsx`)가 매 프레임 다 그리면, 안 보이는 그림에 메인 스레드를 쓴다 —
 * 느린 폰 조건(CPU×4)에서 랭킹 탭에 있는 동안 메인 스레드가 초당 993ms 로 꽉 찼고 화면 갱신은 초당 6번이었다.
 * 덮은 화면이 하나라도 있으면 지도는 그리기를 쉰다.
 *
 * **개수로 센다.** 화면이 바뀔 때 붙고 떨어지는 순서에 기대지 않으려는 것이다 — 참·거짓 하나로 두면
 * 새 화면이 먼저 붙고 옛 화면이 나중에 떨어지는 순서에서, 옛 화면이 떨어지며 새 화면이 덮은 것까지 지운다.
 */
interface MapCoverState {
  covers: number;
  cover: () => void;
  uncover: () => void;
}

export const useMapCoverStore = create<MapCoverState>()((set) => ({
  covers: 0,
  cover: () => set((s) => ({ covers: s.covers + 1 })),
  uncover: () => set((s) => ({ covers: Math.max(0, s.covers - 1) })),
}));
