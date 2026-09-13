/**
 * 탐색 설문 (S15P21A405-294).
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

/** 부정 응답의 이유. 백엔드 CHECK 제약과 같은 값이어야 한다 */
export type SurveyReason = "dup" | "mood" | "tempo" | "spoken";

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
 * 평가 대상을 가리키는 값. **탐색 결과를 받는 순간 만들어 곡마다 들고 있는다.**
 *
 * `sessionId` 와 `rank` 가 행의 식별자다(`UNIQUE(session_id, rank)`). 그래서 같은 곡을
 * 다시 평가하면 새 행이 아니라 같은 행이 갱신된다.
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
  /** journey: 앞 역 (1역은 출발곡) */
  prevMusicId?: Id;
  /** 평가 대상 곡 */
  musicId: Id;
}

/**
 * 설문 하나를 띄우는 데 필요한 것.
 *
 * **제목은 화면에만 쓰고 서버로 보내지 않는다.** 그래서 전송 타입(`SurveySubmission`)이
 * 상속하는 `SurveyTarget` 밖에 둔다 — 안에 넣으면 표시용 값이 그대로 요청에 실린다.
 */
export interface SurveyPrompt {
  target: SurveyTarget;
  /** 비교 상대 곡 제목. nearby 는 기준곡, journey 는 앞 역 */
  compareTitle: string;
}

/**
 * 서버로 보내는 한 건. 곡 하나가 끝날 때마다 1건이다.
 *
 * `verdict` 와 `reason` 의 관계를 DB 가 강제한다:
 * `CHECK ((verdict = false) = (reason IS NOT NULL))` — 부정이면 이유가 **반드시** 있어야 하고,
 * 긍정이거나 무응답이면 이유가 **없어야** 한다. 어기면 저장이 거부된다.
 */
export interface SurveySubmission extends SurveyTarget {
  /** 브라우저 localStorage UUID. 비로그인 배포에서 사람을 구분하는 유일한 값 */
  anonymousId: string;
  /** true 비슷·자연스러움 / false 아님 / null 20초 전 종료·스킵 */
  verdict: boolean | null;
  /** `verdict === false` 일 때만 채운다 */
  reason: SurveyReason | null;
  /** 실제 들은 초 */
  listenedSec: number;
  /** 사용자가 넘겼는가 */
  skipped: boolean;
}
