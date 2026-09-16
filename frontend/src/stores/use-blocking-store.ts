import { create } from "zustand";
import type { PlayContext } from "./use-player-store";

/**
 * 곧 재생될 것. 끼어드는 쪽이 **무엇을 틀려는지 보고** 판단할 수 있게 함께 넘긴다
 * (S15P21A405-371). 없어도 되는 값이라 optional 이다 — 다음/이전처럼 목록 안에서
 * 자리만 옮기는 전환은 굳이 대상을 알릴 필요가 없다.
 */
export interface PlaybackIntent {
  musicId: number;
  /** 이 재생이 속한 탐색. 화면이 그 순간 나타내던 것을 그대로 넘긴다 */
  context?: PlayContext;
}

/** Optional playback interceptor. Core playback does not import its consumer. */
interface BlockingState {
  gate: ((resume: () => void, intent?: PlaybackIntent) => boolean) | null;
  busy: boolean;
  setGate: (gate: BlockingState["gate"]) => void;
  setBusy: (busy: boolean) => void;
}

export const useBlockingStore = create<BlockingState>()((set) => ({
  gate: null,
  busy: false,
  setGate: (gate) => set({ gate }),
  setBusy: (busy) => set({ busy }),
}));

let transactionDepth = 0;

/** Activity teardown + playback + side effects commit together, exactly once.
 * Nested player actions do not open a second gate. With no interceptor this is
 * simply a synchronous call. No optional feature owns core playback state. */
export function runPlaybackTransition(commit: () => void, intent?: PlaybackIntent): void {
  if (transactionDepth > 0) { commit(); return; }
  let committed = false;
  const resume = () => {
    if (committed) return;
    committed = true;
    transactionDepth += 1;
    try { commit(); } finally { transactionDepth -= 1; }
  };
  if (useBlockingStore.getState().gate?.(resume, intent) !== true) resume();
}
