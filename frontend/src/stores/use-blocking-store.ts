import { create } from "zustand";

/**
 * **곡을 바꾸기 전에 끼어드는 자리** (S15P21A405-258 · 335).
 *
 * 답을 강제하는 창(설문 등)은 "지금 듣던 곡을 떠나려는 순간" 에 떠야 한다. 그러려면 재생을
 * 시작하는 쪽이 먼저 물어봐 줘야 하는데, 재생 코드가 그 창을 직접 알면 안 된다 — 임시 기능이라
 * 언젠가 통째로 지우고, 그때 재생까지 손봐야 하기 때문이다.
 *
 * 그래서 재생 코드는 **여기 꽂힌 함수가 무엇인지 모른 채** 부르기만 한다.
 * `true` 가 오면 그 전환을 멈추고, 끼어든 쪽이 볼일을 마친 뒤 넘겨받은 `resume` 을 부른다.
 * 꽂힌 것이 없으면 `gate` 가 null 이라 전부 그냥 지나간다 — 설문을 지우면 저절로 원래대로다.
 *
 * 예전에는 이름표를 담은 `blockers` 집합과 `pendingNext` 예약이 따로 있었다. 보류해야 하는
 * 길이 넷(다른 곡 재생·목록 재생·다음·곡 끝남)으로 늘면서, 예약 칸을 길마다 두는 대신
 * **하려던 일을 클로저로 받아 두는** 방식으로 합쳤다.
 */
interface BlockingState {
  /**
   * 곡을 바꾸기 전에 불린다. 끼어들었으면 `true` 를 돌려주고, 나중에 `resume` 을 부른다.
   * `resume` 은 원래 하려던 일을 그대로 다시 부르므로, 끼어들 것이 없어진 뒤에는 통과한다.
   */
  gate: ((resume: () => void) => boolean) | null;
  /**
   * 화면을 덮고 답을 강제하는 창이 떠 있는가.
   *
   * 되감기처럼 **사람이 눌러야만 불리는** 동작은 예약하지 않고 그냥 무시하는 편이 낫다 —
   * 예약해 두면 답을 제출하는 순간 갑자기 뒤로 가버려서 더 이상하다 (S15P21A405-258).
   */
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

/**
 * 곡을 바꾸려는 쪽이 부르는 한 줄. `true` 면 **지금 바꾸지 않는다** — 끼어든 쪽이 나중에
 * `resume` 을 부른다.
 */
export const heldBack = (resume: () => void) => useBlockingStore.getState().gate?.(resume) === true;
