/**
 * 설문 전용 상태 (S15P21A405-294 · 335).
 *
 * **기존 스토어(use-player-store, use-map-store)에 설문 상태를 섞지 않는다.**
 * 최종 배포 때 걷어낼 기능이라, 섞이면 지울 때 리팩터링이 된다.
 *
 * 이 스토어는 기존 스토어를 import 하지 않는다 — 의존이 한 방향(설문 → 없음)이어야
 * 폴더째 삭제할 수 있다. 평가 대상은 띄우는 쪽이 인자로 넘긴다.
 *
 * ## 무엇을 들고 있나
 *
 * 설문 1건 = **알고리즘이 제안한 간선 하나를 사용자가 실제로 밟았는가.** 그 판정에 필요한
 * 값만 있다 — 밟은 자취(`played`·`lastPlayed`·`unplayable`), 지금 물어야 할 간선(`pending`),
 * 이미 답한 문항(`answered`), 그리고 보류해 둔 이탈(`queued`).
 *
 * 모드별 규칙은 여기 없다. 어느 간선을 밟았는지는 `use-survey-edges` 가 풀고, 여기는
 * 그 결과를 받아 들고 있기만 한다.
 */
import { create } from "zustand";
import { questionKey, type SurveyEdge, type SurveyTarget } from "@/types/survey";

/** 한 곡을 듣는 한 번의 방문. `listened_sec` 값을 만드는 시계다 */
interface Visit {
  musicId: number;
  /** 지금까지 **재생된** 시간(ms). 멈춰 있는 동안은 안 늘어난다 */
  accruedMs: number;
  /** 지금 돌고 있는 재생 구간의 시작 시각. 멈춰 있으면 null */
  playingSince: number | null;
}

interface SurveyState {
  /** 지금 카드에 떠 있는 것. null 이면 설문이 안 떠 있다 */
  prompt: SurveyEdge | null;
  /**
   * **지금 곡을 떠날 때 물을 것.** 곡을 틀기 시작할 때 정해지고, 물어서 답을 받으면 비워진다.
   *
   * 목록을 가리키지 않고 값을 복사해 둔다 — 건너가기·뷰 끄기로 탐색 결과가 갈려도
   * 이미 밟은 간선은 그대로 물어야 한다.
   */
  pending: SurveyEdge | null;
  /**
   * 카드 때문에 보류해 둔 이탈. 제출하면 이것이 실행된다.
   *
   * **한 자리뿐이고 마지막 의도가 이긴다** — 답하는 동안 곡이 끝나 자동 넘김까지 들어오면
   * 둘을 다 실행할 수는 없다.
   */
  queued: (() => void) | null;

  /** 소리가 난 적 있는 곡. 주변 탐색은 기준곡이 여기 있으면 물을 수 있다 */
  played: ReadonlySet<number>;
  /** 마지막으로 소리가 난 곡. 경로 탐색의 비교 상대가 이것이다 */
  lastPlayed: number | null;
  /**
   * 재생하려 했지만 `videoId` 가 없어 한 음도 못 들려준 곡.
   *
   * 경로에서 이 곡들은 **없는 셈 치고 간선을 잇는다** (S15P21A405-335) — A→B→C 에서 B 가
   * 여기 있으면 A→C 를 묻는다. 들려주지도 못한 곡 하나 때문에 전환 평가가 둘 비면 안 된다.
   */
  unplayable: ReadonlySet<number>;
  /** 이미 답한 문항 (`questionKey`). 서버 `/answered` + 이번 세션 응답 */
  answered: ReadonlySet<string>;

  /** 지금 듣고 있는 곡의 방문 */
  visit: Visit | null;

  /**
   * 곡을 틀거나 재생·정지가 바뀌었다 — 방문을 열거나 시계만 맞춘다.
   *
   * **한 번에 둘 다 한다.** 예전에는 방문 여는 effect 와 시계 켜는 effect 가 따로였고,
   * 순서가 뒤집히면 이전 곡의 방문에 시계를 켜는 버그가 주석으로만 막혀 있었다.
   * `musicId` 가 null 이면(재생이 통째로 멈춤) 시계만 세우고 방문은 남긴다 — 아직 그 곡의
   * 설문을 묻지 않았을 수 있어서 청취 시간이 필요하다.
   */
  enter: (musicId: number | null, playing: boolean, at: number) => void;
  /** 그 곡을 지금까지 **재생한** 시간(ms) */
  stintMs: (musicId: number) => number;

  markPlayed: (musicId: number) => void;
  markUnplayable: (musicId: number) => void;

  setPending: (edge: SurveyEdge | null) => void;
  /**
   * 곡을 바꾸기 전에 끼어든다 — 물을 것이 있으면 카드를 띄우고 `true` 를 돌려준다.
   *
   * 재생 코드는 이 함수가 설문인 줄 모른다 (`use-blocking-store` 의 자리에 꽂힌다).
   * `true` 를 받으면 그 전환을 멈추고, 카드가 닫힐 때 `resume` 이 대신 불린다.
   */
  gate: (resume: () => void) => boolean;
  /** 답했거나 포기했다 — 카드를 닫고 보류해 둔 이탈을 실행한다 */
  close: () => void;

  loadAnswered: (keys: readonly string[]) => void;
  markAnswered: (target: SurveyTarget) => void;
  hasAnswered: (target: SurveyTarget) => boolean;
}

/** 방문이 지금까지 쌓은 재생 시간 */
const playedMs = (v: Visit, now: number) => v.accruedMs + (v.playingSince == null ? 0 : now - v.playingSince);

/** 집합에 하나 더한 새 집합. zustand 가 바뀐 것을 알아보게 매번 새로 만든다 */
const withAdded = <T,>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => (set.has(value) ? set : new Set(set).add(value));

export const useSurveyStore = create<SurveyState>()((set, get) => ({
  prompt: null,
  pending: null,
  queued: null,
  played: new Set<number>(),
  lastPlayed: null,
  unplayable: new Set<number>(),
  answered: new Set<string>(),
  visit: null,

  enter: (musicId, playing, at) =>
    set((s) => {
      const v = s.visit;
      // 곡이 바뀌었다 — 새 방문을 연다
      if (musicId != null && v?.musicId !== musicId) {
        return { visit: { musicId, accruedMs: 0, playingSince: playing ? at : null } };
      }
      if (!v) return s;
      // 같은 곡(또는 재생이 통째로 멈춤) — 시계만 맞춘다
      const shouldRun = playing && musicId != null;
      if (shouldRun) return v.playingSince == null ? { visit: { ...v, playingSince: at } } : s;
      if (v.playingSince == null) return s;
      return { visit: { ...v, accruedMs: v.accruedMs + (at - v.playingSince), playingSince: null } };
    }),

  stintMs: (musicId) => {
    const v = get().visit;
    return v?.musicId === musicId ? playedMs(v, Date.now()) : 0;
  },

  markPlayed: (musicId) =>
    set((s) => (s.lastPlayed === musicId && s.played.has(musicId) ? s : { played: withAdded(s.played, musicId), lastPlayed: musicId })),

  markUnplayable: (musicId) => set((s) => (s.unplayable.has(musicId) ? s : { unplayable: withAdded(s.unplayable, musicId) })),

  setPending: (pending) => set((s) => (s.pending === pending ? s : { pending })),

  gate: (resume) => {
    const s = get();
    // 답하는 중이면 새 질문으로 갈아치우지 않는다. 들어온 의도만 뒤로 미룬다
    if (s.prompt) {
      set({ queued: resume });
      return true;
    }
    if (!s.pending || s.answered.has(questionKey(s.pending.target))) return false;
    set({ prompt: s.pending, pending: null, queued: resume });
    return true;
  },

  close: () => {
    const resume = get().queued;
    set({ prompt: null, queued: null });
    resume?.();
  },

  loadAnswered: (keys) =>
    set((s) => {
      if (!keys.length) return s;
      const next = new Set(s.answered);
      keys.forEach((k) => next.add(k));
      return next.size === s.answered.size ? s : { answered: next };
    }),

  markAnswered: (target) => set((s) => ({ answered: withAdded(s.answered, questionKey(target)) })),

  hasAnswered: (target) => get().answered.has(questionKey(target)),
}));
