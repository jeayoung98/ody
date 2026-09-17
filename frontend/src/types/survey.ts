/**
 * 탐색 설문 (S15P21A405-294 · 335).
 *
 * **`explore_feedback` 테이블·`POST /api/feedback` 계약을 그대로 옮긴 것이다.**
 * 필드를 바꾸려면 백엔드와 함께 바꾼다 — 정본은 `docs/api-spec.md` 5.1 이다.
 *
 * **최종 배포 때 걷어낼 기능이다.** 이 파일과 survey 관련 파일은 전부 함께 삭제된다.
 * 기존 도메인 타입(`music.ts` 등)에 설문용 필드를 섞지 않는다.
 */
import type { Id } from "./common";

/** 어떤 탐색을 평가하는가 */
export type SurveyMode = "nearby" | "journey";

/**
 * 부정 응답의 이유. **백엔드 CHECK 제약과 같은 값이어야 한다.**
 *
 * `compare` 는 S15P21A405-380 에서 더했다 — **백엔드가 아직 이 값을 모른다.** 값을 늘려 주기
 * 전까지 이 이유로 낸 응답은 저장에서 거부된다 (BACKEND-NOTES A-29). 조용히 사라지지는 않는다:
 * 저장 실패는 카드에 재시도·포기로 드러난다 (S15P21A405-369).
 */
export type SurveyReason = "dup" | "mood" | "tempo" | "spoken" | "compare";

export interface SurveyReasonOption {
  value: SurveyReason;
  label: string;
}

/**
 * 한 종류(주변/경로)의 설문 정의.
 *
 * 단계는 늘 둘이다 — 판정 한 번, 부정일 때 이유 한 번. 백엔드가 `verdict` 하나와
 * `reason` 하나만 받으므로 단계를 늘리려면 테이블부터 바꿔야 한다.
 */
export interface SurveyDefinition {
  mode: SurveyMode;
  /** 비교 상대를 가리키는 말. 제목 위에 붙는다 ("기준곡" / "앞 곡") */
  compareLabel: string;
  question: string;
  /** 긍정 답의 문구. 질문마다 자연스러운 말이 달라서 따로 둔다 */
  yes: string;
  reasonQuestion: string;
  reasons: readonly SurveyReasonOption[];
}

/**
 * 서버로 나가는 식별자. **평가 대상 간선 하나**를 가리킨다.
 *
 * `sessionId` 와 `rank` 는 행의 자리(`UNIQUE(session_id, rank)`)이고, 같은 답을 두 번 받지
 * 않는 기준은 그것이 아니라 **문항 키**다 (`questionKey`, S15P21A405-346).
 */
export interface SurveyTarget {
  /** 탐색 1회. 주변·경로 응답을 받을 때 만든다 */
  sessionId: string;
  mode: SurveyMode;
  /** nearby: 이웃 순서(1부터) / journey: 정거장 step. 0(기준곡·출발곡)은 설문 대상이 아니다 */
  rank: number;
  /** nearby: 기준곡 / journey: 출발곡 */
  anchorMusicId: Id;
  /** journey: 도착곡 */
  targetMusicId?: Id;
  /**
   * journey: 비교 상대가 된 앞 역. **경로표의 바로 앞 역이 아닐 수 있다** — 재생 불가 역은
   * 없는 셈 치고 이어붙이므로(S15P21A405-335) A→B→C 에서 B 가 못 들려준 곡이면 여기는 A 다.
   */
  prevMusicId?: Id;
  /** 평가 대상 곡 */
  musicId: Id;
}

/**
 * 답을 두 번 받지 않는 기준 (S15P21A405-346).
 *
 * 서버가 같은 사람 × 같은 문항을 한 번만 저장하고, 그 문항의 정의가 이것이다.
 * **`sessionId` 와 `rank` 는 들어가지 않는다** — 같은 탐색을 다시 열면 세션이 새로 생기는데,
 * 세션으로 세면 같은 질문을 또 묻고 서버는 저장하지 않고 조용히 버린다.
 */
export const questionKey = (t: { mode: SurveyMode; anchorMusicId: Id; prevMusicId?: Id | null; musicId: Id }) =>
  `${t.mode}|${t.anchorMusicId}|${t.prevMusicId ?? ""}|${t.musicId}`;

/**
 * 물을 준비가 끝난 간선 하나. **스토어는 이것만 들고 있다.**
 *
 * 곡 목록이 갈려도(건너가기·뷰 끄기) 물어야 할 것이 사라지면 안 되므로, 표를 가리키지 않고
 * 필요한 값을 **복사해** 둔다.
 */
export interface SurveyEdge {
  target: SurveyTarget;
  /** 평가 대상 — 방금 들은 곡 */
  subject: SurveySong;
  /** 비교 상대 — 주변은 기준곡, 경로는 이어붙인 앞 역 */
  compare: SurveySong;
}

/**
 * 카드에 곡 하나를 보여주는 데 필요한 것. **전부 화면용이고 서버로 안 간다.**
 *
 * 값은 이미 받아 둔 탐색 응답 안에 있다 — 카드를 띄우려고 새로 부르지 않는다.
 */
export interface SurveySong {
  /** 절차적 커버를 그리는 씨앗. 지도·곡 상세와 같은 그림이 나오려면 곡 ID 가 필요하다 */
  musicId: Id;
  title: string;
  artist: string | null;
  /**
   * 곡 길이(초). **청취 시간의 상한**이다 — 카드를 띄워두거나 탭을 놔두면 시계는 계속 도는데
   * 곡 길이보다 오래 들었다는 값은 거짓이라 여기서 자른다.
   *
   * 지금은 경로 탐색만 받는다. 주변 탐색 응답(`neighbors`)에는 `duration` 이 없다
   * (BACKEND-NOTES A-22) — 그때는 자를 수 없어 서버 상한(32767)만 적용된다.
   */
  durationSec?: number | null;
  /** 별 색. 커버는 `coverFor` 가 이 값과 `musicId` 로 그린다 */
  genreId: number | null;
}

/**
 * 서버로 보내는 한 건. 간선 하나가 1건이다.
 *
 * `verdict` 와 `reason` 의 관계를 DB 가 강제한다:
 * `CHECK ((verdict = false) = (reason IS NOT NULL))` — 부정이면 이유가 **반드시** 있어야 하고,
 * 긍정이거나 무응답이면 이유가 **없어야** 한다. 어기면 저장이 거부된다.
 */
export interface SurveySubmission extends SurveyTarget {
  /** 브라우저 localStorage UUID. 비로그인 배포에서 사람을 구분하는 유일한 값 */
  anonymousId: string;
  /** true 비슷·자연스러움 / false 아님 / null 답하지 않고 페이지를 떠남 */
  verdict: boolean | null;
  /** `verdict === false` 일 때만 채운다 */
  reason: SurveyReason | null;
  /** 실제 들은 초 */
  listenedSec: number;
  /** 사용자가 넘겼는가 */
  skipped: boolean;
}

/** `GET /api/feedback/answered` 한 줄 (S15P21A405-346). 문항 키를 만들 값만 온다 */
export interface AnsweredRow {
  mode: SurveyMode;
  anchorMusicId: Id;
  prevMusicId: Id | null;
  musicId: Id;
  verdict: boolean;
}
