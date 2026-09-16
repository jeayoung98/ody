import { create } from "zustand";

/** Optional playback interceptor. Core playback does not import its consumer. */
interface BlockingState {
  gate: ((resume: () => void) => boolean) | null;
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
export function runPlaybackTransition(commit: () => void): void {
  if (transactionDepth > 0) { commit(); return; }
  let committed = false;
  const resume = () => {
    if (committed) return;
    committed = true;
    transactionDepth += 1;
    try { commit(); } finally { transactionDepth -= 1; }
  };
  if (useBlockingStore.getState().gate?.(resume) !== true) resume();
}
