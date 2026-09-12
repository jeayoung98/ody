/**
 * 설문 전용 상태 (S15P21A405-250).
 *
 * **기존 스토어(use-player-store, use-map-store)에 설문 상태를 섞지 않는다.**
 * 최종 배포 때 걷어낼 기능이라, 섞이면 지울 때 리팩터링이 된다.
 *
 * 이 스토어는 기존 스토어를 import 하지 않는다 — 의존이 한 방향(설문 → 없음)이어야
 * 폴더째 삭제할 수 있다. 평가 대상은 띄우는 쪽이 인자로 넘긴다.
 */
import { create } from "zustand";
import type { SurveyTarget } from "@/types/survey";

interface SurveyState {
  /** 지금 묻고 있는 대상. null 이면 설문이 떠 있지 않다 */
  target: SurveyTarget | null;
  /** 몇 번째 단계인가 (0-based) */
  stepIndex: number;
  /** 단계별로 고른 값 */
  answers: string[][];
  /** 질문이 뜬 시각 — 제출까지 걸린 시간을 재서 대충 찍은 응답을 구분한다 */
  openedAt: number;
  /** 같은 짝을 두 번 묻지 않기 위한 기록 (`keyOf` 참고) */
  asked: Set<string>;

  open: (target: SurveyTarget) => void;
  choose: (values: string[]) => void;
  next: () => void;
  close: () => void;
  hasAsked: (target: SurveyTarget) => boolean;
}

/**
 * 중복 판정 키 — **짝까지 넣는다.**
 *
 * 곡 ID만 쓰면 같은 곡이 다른 앞 곡(또는 다른 기준곡)에서 이어져도 안 묻는다.
 * 그건 평가 대상이 다른 전환이라 응답을 그만큼 잃는다. 반대로 짝까지 같으면
 * 답이 이미 나온 질문이라 다시 묻지 않는다 — 안 그러면 제출 직후 같은 질문이 또 뜬다.
 */
const keyOf = (t: SurveyTarget) => `${t.kind}:${t.prevMusicId ?? t.centerMusicId ?? ""}>${t.musicId}`;

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  target: null,
  stepIndex: 0,
  answers: [],
  openedAt: 0,
  asked: new Set(),

  open: (target) => {
    // 이미 물어본 대상이면 다시 띄우지 않는다
    if (get().asked.has(keyOf(target))) return;
    set({ target, stepIndex: 0, answers: [], openedAt: Date.now() });
  },

  /** 현재 단계의 선택을 기록한다. 단계 이동은 하지 않는다 */
  choose: (values) =>
    set((s) => {
      const answers = [...s.answers];
      answers[s.stepIndex] = values;
      return { answers };
    }),

  next: () => set((s) => ({ stepIndex: s.stepIndex + 1 })),

  close: () =>
    set((s) => {
      const asked = new Set(s.asked);
      if (s.target) asked.add(keyOf(s.target));
      return { target: null, stepIndex: 0, answers: [], openedAt: 0, asked };
    }),

  hasAsked: (target) => get().asked.has(keyOf(target)),
}));
