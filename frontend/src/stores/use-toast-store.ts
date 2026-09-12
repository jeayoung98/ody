import { create } from "zustand";

/** 토스트가 떠 있는 시간(ms) */
const TOAST_MS = 2600;

interface ToastState {
  /** 지금 띄운 문구. 없으면 null */
  message: string | null;
  /** 같은 문구를 다시 눌러도 다시 뜨게 하는 값 */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * 화면 아래에 잠깐 뜨는 안내 (#toast).
 * **동작이 막혔을 때 왜 막혔는지** 알려주는 용도다 — 눌렀는데 아무 일도 안 나는 것이 제일 나쁘다.
 */
export const useToastStore = create<ToastState>()((set, get) => ({
  message: null,
  seq: 0,
  show: (message) => {
    if (timer) clearTimeout(timer);
    set({ message, seq: get().seq + 1 });
    timer = setTimeout(() => set({ message: null }), TOAST_MS);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));
