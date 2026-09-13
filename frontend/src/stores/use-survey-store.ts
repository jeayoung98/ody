/**
 * 설문 전용 상태 (S15P21A405-294).
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
  /**
   * 곡별 누적 청취 시간(ms).
   *
   * **지나간 곡을 얼마나 들었는지는 여기서만 알 수 있다.** 지금 듣는 곡은 타이머로 재면
   * 되지만, 이미 떠나보낸 곡은 잴 방법이 없다.
   */
  listenedMs: Record<number, number>;
  /**
   * 이미 전송한 행. `${sessionId}:${rank}` 를 키로 쓴다 — 서버의 `UNIQUE(session_id, rank)` 와
   * 같은 기준이다. 무응답 행을 보낸 뒤 같은 곡을 또 묻거나 보내는 낭비를 막는다.
   */
  sent: Set<string>;

  open: (target: SurveyTarget) => void;
  close: () => void;
  noteListened: (musicId: number, ms: number) => void;
  markSent: (target: SurveyTarget) => void;
  hasSent: (target: SurveyTarget) => boolean;
}

/** 행의 식별자. 서버의 `UNIQUE(session_id, rank)` 와 같은 기준이다 */
const keyOf = (t: SurveyTarget) => `${t.sessionId}:${t.rank}`;

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  target: null,
  listenedMs: {},
  sent: new Set(),

  open: (target) => {
    // 답하는 중이면 새 질문으로 갈아치우지 않는다. 자동재생(S15P21A405-258)이 붙으면
    // 설문이 떠 있는 동안에도 곡이 뒤에서 넘어갈 수 있고, 그때 답하던 것이 날아간다
    if (get().target) return;
    if (get().sent.has(keyOf(target))) return;
    set({ target });
  },

  close: () => set({ target: null }),

  noteListened: (musicId, ms) =>
    set((s) => ({ listenedMs: { ...s.listenedMs, [musicId]: (s.listenedMs[musicId] ?? 0) + ms } })),

  markSent: (target) => set((s) => ({ sent: new Set(s.sent).add(keyOf(target)) })),

  hasSent: (target) => get().sent.has(keyOf(target)),
}));
