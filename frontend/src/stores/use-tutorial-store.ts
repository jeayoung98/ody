import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { TUTORIAL_STEPS, type TutorialTask } from "@/constants";

interface TutorialState {
  stepIndex: number;
  isDone: boolean;

  /** 태스크 완료 신호. 현재 단계의 태스크와 일치하면 다음 단계로 */
  complete: (task: TutorialTask) => void;
  skip: () => void;
  reset: () => void;
}

export const useTutorialStore = create<TutorialState>()(
  devtools(
    (set, get) => ({
      stepIndex: 0,
      isDone: false,

      complete: (task) => {
        const { stepIndex, isDone } = get();
        if (isDone) return;
        const current = TUTORIAL_STEPS[stepIndex];
        if (!current || current.task !== task) return;
        const nextIndex = stepIndex + 1;
        if (nextIndex >= TUTORIAL_STEPS.length) set({ isDone: true }, false, "complete/done");
        else set({ stepIndex: nextIndex }, false, "complete/next");
      },

      skip: () => set({ isDone: true }, false, "skip"),
      reset: () => set({ stepIndex: 0, isDone: false }, false, "reset"),
    }),
    { name: "tutorial-store" },
  ),
);
