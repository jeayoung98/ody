import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ContestTab } from "@/constants";
import type { ContestMatch, ContestSort, SketchPoint } from "@/types";

/** 빈 목록은 늘 같은 참조 — 셀렉터가 매번 새 배열을 만들지 않게 */
const EMPTY_POINTS: SketchPoint[] = [];

/**
 * 별자리 콘테스트 패널의 **그리다 만 것** (S15P21A405-602).
 *
 * 컴포넌트 state 로 두면 탭을 옮기거나 패널을 잠깐 닫는 순간 그리던 점이 날아간다.
 * 서버 상태(회차·출품작)는 TanStack Query 가 들고, 여기는 아직 서버에 안 보낸 것만 든다.
 *
 * **점을 건드리면 매칭 결과를 버린다.** 결과는 그 점 배치에 대한 답이라, 점이 바뀐 뒤에도
 * 남아 있으면 다른 모양에 붙은 것처럼 보인다. (즉시 심사는 640 에서 없어졌다 — AI 채점은 출품 뒤 서버가 한다)
 */
interface ContestState {
  /** 이벤트 모달이 떠 있는가. 우측 패널과 무관한 **별개 화면**이다 */
  open: boolean;
  tab: ContestTab;
  sort: ContestSort;
  points: SketchPoint[];
  /** 마지막 점 → 첫 점을 잇는가 */
  closed: boolean;
  match: ContestMatch | null;
  title: string;

  toggleOpen: () => void;
  /** 그 탭으로 연다 — 플레이어바 이벤트 태그가 갤러리로 부른다 (S15P21A405-684) */
  openAt: (tab: ContestTab) => void;
  close: () => void;
  setTab: (tab: ContestTab) => void;
  setSort: (sort: ContestSort) => void;
  addPoint: (p: SketchPoint) => void;
  removePoint: (index: number) => void;
  undo: () => void;
  clear: () => void;
  toggleClosed: () => void;
  setMatch: (match: ContestMatch | null) => void;
  setTitle: (title: string) => void;
}

/** 점이 바뀌었다 — 이전 답은 무효 */
const invalidate = { match: null } as const;

export const useContestStore = create<ContestState>()(
  devtools(
    (set) => ({
      open: false,
      tab: "sketch",
      sort: "latest",
      points: EMPTY_POINTS,
      closed: false,
      match: null,
      title: "",

      toggleOpen: () => set((s) => ({ open: !s.open }), false, "toggleOpen"),
      openAt: (tab) => set({ open: true, tab }, false, "openAt"),
      close: () => set({ open: false }, false, "close"),
      setTab: (tab) => set({ tab }, false, "setTab"),
      setSort: (sort) => set({ sort }, false, "setSort"),
      addPoint: (p) => set((s) => ({ points: [...s.points, p], ...invalidate }), false, "addPoint"),
      removePoint: (index) => set((s) => ({ points: s.points.filter((_, i) => i !== index), ...invalidate }), false, "removePoint"),
      undo: () => set((s) => ({ points: s.points.slice(0, -1), ...invalidate }), false, "undo"),
      clear: () => set({ points: EMPTY_POINTS, closed: false, ...invalidate }, false, "clear"),
      toggleClosed: () => set((s) => ({ closed: !s.closed, ...invalidate }), false, "toggleClosed"),
      setMatch: (match) => set({ match }, false, "setMatch"),
      setTitle: (title) => set({ title }, false, "setTitle"),
    }),
    { name: "contest-store" },
  ),
);
