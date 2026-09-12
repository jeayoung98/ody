/**
 * 사용자 설문 (S15P21A405-250).
 *
 * **최종 배포 때 걷어낼 기능이다.** 이 파일과 survey 관련 파일은 전부 함께 삭제된다.
 * 기존 도메인 타입(`music.ts` 등)에 설문용 필드를 섞지 않는다.
 */
import type { Id } from "./common";

/** 어떤 탐색을 평가하는가 */
export type SurveyKind = "nearby" | "transition";

/** 선택지 하나. `value` 가 그대로 서버에 저장된다 */
export interface SurveyOption {
  value: string;
  label: string;
  /**
   * 이 선택지를 고르면 설문을 여기서 끝낸다 (다음 단계로 안 간다).
   * "잘 모르겠어요" 처럼 이유를 물을 필요가 없는 응답에 쓴다.
   */
  terminal?: boolean;
}

/**
 * 설문 한 단계.
 *
 * 단계 수는 이 배열의 길이로 결정된다 — 카드 컴포넌트는 단계 개수를 모른다.
 * 2단계가 4단계로 늘어도 `constants/survey.ts` 만 고치면 된다.
 */
export interface SurveyStep {
  /** 화면에 보이는 질문 */
  question: string;
  /** 복수 선택 허용 여부. false 면 고르는 즉시 다음 단계로 넘어간다 */
  multiple: boolean;
  /**
   * 앞 단계에서 무엇을 골랐는지에 따라 선택지가 달라지는 경우가 있다
   * (비슷해요 → "어떤 점이 비슷했나요", 달라요 → "어떤 점이 달랐나요").
   * 키가 앞 단계의 `value`, 값이 그때 보여줄 선택지다.
   * `question` 도 같이 바뀌면 `questionByPrev` 를 쓴다.
   */
  optionsByPrev?: Record<string, SurveyOption[]>;
  questionByPrev?: Record<string, string>;
  /** 앞 단계와 무관하게 고정된 선택지 */
  options?: SurveyOption[];
}

/** 한 종류(주변/전환)의 설문 정의 */
export interface SurveyDefinition {
  kind: SurveyKind;
  steps: SurveyStep[];
}

/** 평가 대상을 가리키는 값. 주변인지 전환인지에 따라 채워지는 필드가 다르다 */
export interface SurveyTarget {
  kind: SurveyKind;
  /** 평가한 곡 */
  musicId: Id;
  /** 주변 탐색 — 기준곡 */
  centerMusicId?: Id;
  /** 주변 탐색 — 이웃 목록에서 몇 번째였나 (0-based) */
  rank?: number;
  /** 경로 탐색 — 출발·도착곡 */
  startMusicId?: Id;
  endMusicId?: Id;
  /** 경로 탐색 — 직전에 들은 곡 (이 곡으로 이어진 전환을 평가한다) */
  prevMusicId?: Id;
  /** 경로 탐색 — 경로에서 몇 번째 정거장인가 */
  position?: number;
  /** 경로 탐색 — 전체 정거장 수 */
  totalStops?: number;
}

/** 서버로 보내는 한 건의 응답 */
export interface SurveySubmission extends SurveyTarget {
  /** 단계별로 고른 값. `steps` 와 같은 순서 */
  answers: string[][];
  /** 익명 사용자 ID (localStorage 에 보관) */
  anonymousId: string;
  /** 문항 버전 — 문항이 바뀌면 올린다. 이전 응답과 섞이면 안 된다 */
  surveyVersion: string;
  /** 강제 수집분인가. 자발적 응답과 구분해서 분석할 수 있게 */
  forced: boolean;
  /** 질문이 뜬 시각부터 제출까지 걸린 시간(ms). 너무 빠르면 대충 찍은 응답일 수 있다 */
  elapsedMs: number;
  /** 클라이언트 시각 (ISO) */
  answeredAt: string;
}
