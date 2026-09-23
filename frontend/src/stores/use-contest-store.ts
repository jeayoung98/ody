import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ContestTab } from "@/constants";
import type { ContestJudge, ContestMatch, ContestSort, SketchPoint } from "@/types";

/** 빈 목록은 늘 같은 참조 — 셀렉터가 매번 새 배열을 만들지 않게 */
const EMPTY_POINTS: SketchPoint[] = [];

/**
 * 별자리 콘테스트 패널의 **그리다 만 것** (S15P21A405-602).
 *
 * 컴포넌트 state 로 두면 탭을 옮기거나 패널을 잠깐 닫는 순간 그리던 점이 날아간다.
 * 서버 상태(회차·출품작)는 TanStack Query 가 들고, 여기는 아직 서버에 안 보낸 것만 든다.
 *
 * **점을 건드리면 매칭·심사 결과를 버린다.** 결과는 그 점 배치에 대한 답이라, 점이 바뀐 뒤에도
 * 남아 있으면 다른 모양에 붙은 점수처럼 보인다.
 */
interface ContestState {
  tab: ContestTab;
  sort: ContestSort;
  points: SketchPoint[];
  /** 마지막 점 → 첫 점을 잇는가 */
  closed: boolean;
  match: ContestMatch | null;
  judge: ContestJudge | null;
  title: string;

  setTab: (tab: ContestTab) => void;
  setSort: (sort: ContestSort) => void;
  addPoint: (p: SketchPoint) => void;
  removePoint: (index: number) => void;
  undo: () => void;
  clear: () => void;
  toggleClosed: () => void;
  setMatch: (match: ContestMatch | null) => void;
  setJudge: (judge: ContestJudge | null) => void;
  setTitle: (title: string) => void;
}

/** 점이 바뀌었다 — 이전 답은 무효 */
const invalidate = { match: null, judge: null } as const;

export const useContestStore = create<ContestState>()(
  devtools(
    (set) => ({
      tab: "sketch",
      sort: "latest",
      points: EMPTY_POINTS,
      closed: false,
      match: null,
      judge: null,
      title: "",

      setTab: (tab) => set({ tab }, false, "setTab"),
      setSort: (sort) => set({ sort }, false, "setSort"),
      addPoint: (p) => set((s) => ({ points: [...s.points, p], ...invalidate }), false, "addPoint"),
      removePoint: (index) => set((s) => ({ points: s.points.filter((_, i) => i !== index), ...invalidate }), false, "removePoint"),
      undo: () => set((s) => ({ points: s.points.slice(0, -1), ...invalidate }), false, "undo"),
      clear: () => set({ points: EMPTY_POINTS, closed: false, ...invalidate }, false, "clear"),
      toggleClosed: () => set((s) => ({ closed: !s.closed, ...invalidate }), false, "toggleClosed"),
      setMatch: (match) => set({ match, judge: null }, false, "setMatch"),
      setJudge: (judge) => set({ judge }, false, "setJudge"),
      setTitle: (title) => set({ title }, false, "setTitle"),
    }),
    { name: "contest-store" },
  ),
);
