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
import type { ResolvedPrompt, SurveyPrompt, SurveyTarget } from "@/types/survey";

/** 한 곡을 듣는 한 번의 방문 */
interface Visit {
  musicId: number;
  /** 지금까지 **재생된** 시간(ms). 멈춰 있는 동안은 안 늘어난다 */
  accruedMs: number;
  /** 지금 돌고 있는 재생 구간의 시작 시각. 멈춰 있으면 null */
  playingSince: number | null;
}

interface SurveyState {
  /** 지금 묻고 있는 것. null 이면 설문이 떠 있지 않다 */
  prompt: ResolvedPrompt | null;
  /**
   * 곡별 **마지막 체류의 재생 시간**(ms). 누적이 아니다.
   *
   * 15초 듣고 나갔다가 나중에 10초 더 들었으면 **10초**다. 25초로 치지 않는다 —
   * 15초는 이미 `skipped` 행으로 따로 기록됐고, 그걸 다시 "들은 시간" 으로 세면
   * 한 값이 두 뜻을 갖는다.
   */
  lastStintMs: Record<number, number>;
  /**
   * 지금 듣고 있는 곡의 방문.
   *
   * 장부(`lastStintMs`)는 곡을 떠날 때 마감된다. 그래서 **아직 듣고 있는 곡은 장부에 없다** —
   * 설문 카드는 그 곡이 재생 중일 때 뜨므로, 장부만 읽으면 늘 0 이 나간다.
   * 실제로 그랬다: 답한 행의 `listened_sec` 이 전부 0 이었다.
   */
  visit: Visit | null;
  /**
   * 이미 전송한 행. `${sessionId}:${rank}` 를 키로 쓴다 — 서버의 `UNIQUE(session_id, rank)` 와
   * 같은 기준이다. 무응답 행을 보낸 뒤 같은 곡을 또 묻거나 보내는 낭비를 막는다.
   */
  sent: Set<string>;

  /**
   * 물어도 되는 질문인지 판정한다 — **비교 상대를 그 턴에 20초 이상 들었나**.
   *
   * 주변 탐색은 기준곡, 경로 탐색은 **바로 앞 역**이다. 앞 역을 5초만 듣고 넘겼으면
   * 그 전환은 겪지 못한 것이라 **묻지 않는다.**
   *
   * 더 앞의 역까지 거슬러 올라가 묻지 않는 이유는, 그렇게 하면 경로에 없는 전환
   * (1→3)을 평가하게 되기 때문이다. 알고리즘이 고른 간선은 1→2·2→3 뿐이라
   * 하지도 않은 일에 점수를 매기는 꼴이 된다. 건너뛴 역은 스킵 행으로 따로 남고,
   * 그 다음 역부터 평가가 정상 복구된다 — 손실은 전환 하나뿐이다.
   */
  resolve: (prompt: SurveyPrompt, minListenMs: number) => ResolvedPrompt | null;
  open: (prompt: ResolvedPrompt) => void;
  close: () => void;

  /** 곡이 바뀌었다 — 새 방문을 연다 */
  beginVisit: (musicId: number) => void;
  /** 재생이 시작·정지됐다. 멈춘 동안은 시계가 안 돈다 */
  setPlaying: (playing: boolean, at: number) => void;
  /** 곡을 떠난다 — 이번 방문의 재생 시간을 장부에 마감한다 */
  endVisit: () => void;
  /** 그 곡의 **이번 체류 재생 시간**(ms). 지금 곡이면 재는 중, 지나간 곡이면 마지막 체류 */
  stintMs: (musicId: number) => number;

  markSent: (target: SurveyTarget) => void;
  hasSent: (target: SurveyTarget) => boolean;
}

/** 행의 식별자. 서버의 `UNIQUE(session_id, rank)` 와 같은 기준이다 */
const keyOf = (t: SurveyTarget) => `${t.sessionId}:${t.rank}`;

/** 방문이 지금까지 쌓은 재생 시간 */
const played = (v: Visit, now: number) => v.accruedMs + (v.playingSince == null ? 0 : now - v.playingSince);

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  prompt: null,
  lastStintMs: {},
  visit: null,
  sent: new Set(),

  resolve: (prompt, minListenMs) => {
    // 후보는 늘 하나다 — 주변 탐색은 기준곡, 경로 탐색은 바로 앞 역. 못 채웠으면 안 묻는다
    const compare = prompt.candidates[0];
    if (!compare || get().stintMs(compare.musicId) < minListenMs) return null;
    return { target: prompt.target, subject: prompt.subject, compare };
  },

  open: (prompt) => {
    // 답하는 중이면 새 질문으로 갈아치우지 않는다. 자동 넘김(S15P21A405-258)이 붙어 있어서
    // 설문이 떠 있는 동안에도 곡이 뒤에서 넘어갈 수 있고, 그때 답하던 것이 날아간다
    if (get().prompt) return;
    if (get().sent.has(keyOf(prompt.target))) return;
    set({ prompt });
  },

  close: () => set({ prompt: null }),

  beginVisit: (musicId) => set({ visit: { musicId, accruedMs: 0, playingSince: null } }),

  setPlaying: (playing, at) =>
    set((s) => {
      const v = s.visit;
      if (!v) return s;
      if (playing) return v.playingSince == null ? { visit: { ...v, playingSince: at } } : s;
      if (v.playingSince == null) return s;
      return { visit: { ...v, accruedMs: v.accruedMs + (at - v.playingSince), playingSince: null } };
    }),

  endVisit: () =>
    set((s) => {
      const v = s.visit;
      if (!v) return s;
      // **덮어쓴다.** 더하면 15초 스킵 + 10초 재청취가 25초가 되어 어느 쪽도 아닌 값이 된다
      return { lastStintMs: { ...s.lastStintMs, [v.musicId]: played(v, Date.now()) }, visit: null };
    }),

  stintMs: (musicId) => {
    const s = get();
    if (s.visit?.musicId === musicId) return played(s.visit, Date.now());
    return s.lastStintMs[musicId] ?? 0;
  },

  markSent: (target) => set((s) => ({ sent: new Set(s.sent).add(keyOf(target)) })),

  hasSent: (target) => get().sent.has(keyOf(target)),
}));
