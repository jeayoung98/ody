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
  /** `journey` 는 `prevMusicId` 가 아직 확정이 아니다 — 아래 `candidates` 로 정해진다 */
  target: SurveyTarget;
  /** 평가 대상 — 방금 들은 곡. 상대만 보여주면 둘 중 뭘 묻는지 알 수 없다 */
  subject: SurveySong;
  /**
   * 비교 상대 후보. **늘 하나다** — 주변 탐색은 기준곡, 경로 탐색은 바로 앞 역.
   *
   * 그 곡을 20초 못 들었으면 **묻지 않는다.** 더 앞까지 거슬러 올라가지 않는다 —
   * 경로에 없는 전환(1→3)을 평가하게 되기 때문이다 (S15P21A405-294 코멘트).
   */
  candidates: readonly SurveySong[];
}


/**
 * 비교 상대가 정해진 상태. **스토어는 이것만 들고 있다** — 카드가 보여주는 것도,
 * 서버로 나가는 `prevMusicId` 도 여기서 확정된 값이다.
 */
export interface ResolvedPrompt {
  target: SurveyTarget;
  subject: SurveySong;
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
  /**
   * 별 색. 커버는 `coverFor` 가 이 값과 `musicId` 로 그린다.
   *
   * 지금은 `STAR_LOOK.randomColor` 가 켜져 있어 `musicId` 해시로만 색이 정해지고 이 값은
   * 안 쓰인다 (실데이터에 장르가 거의 없어서다). 그 스위치가 내려가면 다시 쓰인다.
   */
  genreId: number | null;
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
