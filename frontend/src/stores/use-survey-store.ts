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

/** 평가곡과 비교하는 상대 — 경로 탐색이면 앞 곡, 주변 탐색이면 기준곡 */
export const referenceMusicId = (t: SurveyTarget) => t.prevMusicId ?? t.centerMusicId ?? null;

interface SurveyState {
  /** 지금 묻고 있는 대상. null 이면 설문이 떠 있지 않다 */
  target: SurveyTarget | null;
  /** 질문이 뜬 시각 — 제출까지 걸린 시간을 재서 대충 찍은 응답을 구분한다 */
  openedAt: number;
  /** 같은 짝을 두 번 묻지 않기 위한 기록 (`keyOf` 참고) */
  asked: Set<string>;
  /**
   * 곡별 누적 청취 시간(ms).
   *
   * **지나간 곡을 얼마나 들었는지는 여기서만 알 수 있다.** 지금 듣는 곡은 타이머로 재면
   * 되지만, 비교 상대(앞 곡·기준곡)는 이미 지나가서 잴 방법이 없다.
   */
  listenedMs: Record<number, number>;

  open: (target: SurveyTarget) => void;
  close: () => void;
  hasAsked: (target: SurveyTarget) => boolean;
  noteListened: (musicId: number, ms: number) => void;
}

/**
 * 중복 판정 키 — **짝까지 넣는다.**
 *
 * 곡 ID만 쓰면 같은 곡이 다른 앞 곡(또는 다른 기준곡)에서 이어져도 안 묻는다.
 * 그건 평가 대상이 다른 전환이라 응답을 그만큼 잃는다. 반대로 짝까지 같으면
 * 답이 이미 나온 질문이라 다시 묻지 않는다 — 안 그러면 제출 직후 같은 질문이 또 뜬다.
 */
const keyOf = (t: SurveyTarget) => `${t.kind}:${referenceMusicId(t) ?? ""}>${t.musicId}`;

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  target: null,
  openedAt: 0,
  asked: new Set(),
  listenedMs: {},

  open: (target) => {
    const s = get();
    // 답하는 중이면 새 질문으로 갈아치우지 않는다. 자동재생(S15P21A405-258)이 붙으면
    // 설문이 떠 있는 동안에도 곡이 뒤에서 넘어갈 수 있고, 그때 답하던 것이 날아간다
    if (s.target) return;
    // 이미 물어본 짝이면 다시 띄우지 않는다
    if (s.asked.has(keyOf(target))) return;
    set({ target, openedAt: Date.now() });
  },

  close: () =>
    set((s) => {
      const asked = new Set(s.asked);
      if (s.target) asked.add(keyOf(s.target));
      return { target: null, openedAt: 0, asked };
    }),

  hasAsked: (target) => get().asked.has(keyOf(target)),

  noteListened: (musicId, ms) =>
    set((s) => ({ listenedMs: { ...s.listenedMs, [musicId]: (s.listenedMs[musicId] ?? 0) + ms } })),
}));
