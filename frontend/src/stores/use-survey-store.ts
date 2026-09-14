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

interface SurveyState {
  /** 지금 묻고 있는 것. null 이면 설문이 떠 있지 않다 */
  prompt: ResolvedPrompt | null;
  /**
   * 곡별 누적 청취 시간(ms).
   *
   * **지나간 곡을 얼마나 들었는지는 여기서만 알 수 있다.** 지금 듣는 곡은 타이머로 재면
   * 되지만, 이미 떠나보낸 곡은 잴 방법이 없다.
   */
  listenedMs: Record<number, number>;
  /**
   * **지금 듣고 있는 곡과 그 곡이 현재 곡이 된 시각.**
   *
   * 장부(`listenedMs`)는 곡을 떠날 때 마감된다. 그래서 **아직 듣고 있는 곡은 장부에 없다** —
   * 설문 카드는 그 곡이 재생 중일 때 뜨므로, 장부만 읽으면 늘 0 이 나간다.
   * 실제로 그랬다: 답한 행의 `listened_sec` 이 전부 0 이었다.
   */
  since: { musicId: number; at: number } | null;
  /**
   * 이미 전송한 행. `${sessionId}:${rank}` 를 키로 쓴다 — 서버의 `UNIQUE(session_id, rank)` 와
   * 같은 기준이다. 무응답 행을 보낸 뒤 같은 곡을 또 묻거나 보내는 낭비를 막는다.
   */
  sent: Set<string>;

  /**
   * 비교 상대를 확정한다 — **20초 이상 들은 가장 가까운 후보**.
   *
   * 주변 탐색은 후보가 기준곡 하나라 "기준곡을 20초 들었나" 를 묻는 것과 같다.
   * 경로 탐색은 앞 역부터 거슬러 올라간다 — 5초만 듣고 넘긴 역은 그 전환을 겪지 못한
   * 것이라 건너뛰고, 실제로 들은 역과 비교한다. `prevMusicId` 도 그 역으로 바꿔 보낸다.
   *
   * 하나도 못 채웠으면 `null` — 물을 수 없는 질문이다.
   */
  resolve: (prompt: SurveyPrompt, minListenMs: number) => ResolvedPrompt | null;
  open: (prompt: ResolvedPrompt) => void;
  close: () => void;
  beginListening: (musicId: number, at: number) => void;
  noteListened: (musicId: number, ms: number) => void;
  /** 그 곡을 지금까지 들은 시간(ms) — 마감된 장부 + 아직 안 끝난 이번 체류 */
  elapsedMs: (musicId: number) => number;
  markSent: (target: SurveyTarget) => void;
  hasSent: (target: SurveyTarget) => boolean;
}

/** 행의 식별자. 서버의 `UNIQUE(session_id, rank)` 와 같은 기준이다 */
const keyOf = (t: SurveyTarget) => `${t.sessionId}:${t.rank}`;

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  prompt: null,
  listenedMs: {},
  since: null,
  sent: new Set(),

  resolve: (prompt, minListenMs) => {
    const heard = prompt.candidates.find((c) => get().elapsedMs(c.musicId) >= minListenMs);
    if (!heard) return null;
    // 경로 탐색은 건너뛴 역을 지나 실제로 들은 역을 가리키게 된다 — 서버에도 그 역을 보낸다
    const target = prompt.target.mode === "journey" ? { ...prompt.target, prevMusicId: heard.musicId } : prompt.target;
    return { target, subject: prompt.subject, compare: heard.song };
  },

  open: (prompt) => {
    // 답하는 중이면 새 질문으로 갈아치우지 않는다. 자동재생(S15P21A405-258)이 붙으면
    // 설문이 떠 있는 동안에도 곡이 뒤에서 넘어갈 수 있고, 그때 답하던 것이 날아간다
    if (get().prompt) return;
    if (get().sent.has(keyOf(prompt.target))) return;
    set({ prompt });
  },

  close: () => set({ prompt: null }),

  beginListening: (musicId, at) => set({ since: { musicId, at } }),

  noteListened: (musicId, ms) =>
    set((s) => ({
      listenedMs: { ...s.listenedMs, [musicId]: (s.listenedMs[musicId] ?? 0) + ms },
      // 마감했으니 이번 체류는 끝났다. 안 지우면 뒤에 한 번 더 더해진다
      since: s.since?.musicId === musicId ? null : s.since,
    })),

  elapsedMs: (musicId) => {
    const s = get();
    const closed = s.listenedMs[musicId] ?? 0;
    const open = s.since?.musicId === musicId ? Date.now() - s.since.at : 0;
    return closed + open;
  },

  markSent: (target) => set((s) => ({ sent: new Set(s.sent).add(keyOf(target)) })),

  hasSent: (target) => get().sent.has(keyOf(target)),
}));
