import { create } from "zustand";
import { devtools } from "zustand/middleware";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 확인 시 실행 */
  onConfirm: () => void;
}

interface ConfirmState {
  pending: ConfirmRequest | null;
  ask: (req: ConfirmRequest) => void;
  confirm: () => void;
  cancel: () => void;
}

/** 전역 확인 팝업 하나. 동시에 하나만 뜬다 */
export const useConfirmStore = create<ConfirmState>()(
  devtools(
    (set, get) => ({
      pending: null,
      ask: (pending) => set({ pending }, false, "ask"),
      confirm: () => {
        const p = get().pending;
        set({ pending: null }, false, "confirm");
        p?.onConfirm();
      },
      cancel: () => set({ pending: null }, false, "cancel"),
    }),
    { name: "confirm-store" },
  ),
);
