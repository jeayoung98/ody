import { create } from "zustand";

/**
 * **화면을 덮고 사용자 응답을 강제하는 창**이 떠 있는지 (S15P21A405-258).
 *
 * 자동 넘김이 이걸 본다 — 답을 기다리는 창이 떠 있는 동안 뒤에서 곡이 넘어가면,
 * 사용자는 A 에 대해 답하는데 이미 B 가 재생 중인 상태가 된다.
 *
 * **왜 따로 두나**: 막는 쪽(설문 등)은 임시 기능이라 언젠가 통째로 지운다. 재생 코드가
 * 그 기능을 직접 알면 지울 때 재생까지 손봐야 한다. 여기서는 "누군가 막고 있다" 만 알고,
 * 막는 쪽이 사라지면 `blockers` 가 늘 비어 있어 자동으로 원래대로 돌아간다.
 *
 * 이름표(`id`)를 쓰는 이유는 겹칠 수 있어서다 — 둘이 막았는데 하나가 풀었다고 풀리면 안 된다.
 */
interface BlockingState {
  blockers: ReadonlySet<string>;
  block: (id: string) => void;
  unblock: (id: string) => void;
}

export const useBlockingStore = create<BlockingState>()((set) => ({
  blockers: new Set<string>(),

  block: (id) =>
    set((s) => {
      if (s.blockers.has(id)) return s;
      const next = new Set(s.blockers);
      next.add(id);
      return { blockers: next };
    }),

  unblock: (id) =>
    set((s) => {
      if (!s.blockers.has(id)) return s;
      const next = new Set(s.blockers);
      next.delete(id);
      return { blockers: next };
    }),
}));
