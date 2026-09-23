/**
 * 음악 취향 분석 (S15P21A405-630). 백엔드 계약은 `backend/.../taste/dto/TasteAnalysisResponse.java`
 * 이고, 이 파일은 2026-09-23 `origin/backend/dev` 의 그 파일을 읽어 옮긴 것이다 (S15P21A405-512).
 *
 * **본인 것만 나온다.** 두 엔드포인트 다 `Authentication` 으로 사람을 정하므로 남의 취향은
 * 물어볼 수가 없다 — 남의 프로필 화면에 붙일 수 없다는 뜻이다.
 */

/**
 * 지금 무엇을 보여 줄 수 있는가.
 *
 * - `EMPTY` 좋아요한 곡이 하나도 없다
 * - `DISTRIBUTION_ONLY` 좌표가 있는 곡이 10개 미만 — 분포는 재지만 리포트는 못 만든다
 * - `READY` 만들 수 있는데 아직 안 만들었다
 * - `FRESH` 만들어 둔 리포트가 지금 좋아요 목록과 같다
 * - `STALE` 그 뒤로 좋아요가 바뀌었다. 리포트는 그대로 보여 주고 다시 만들 수 있다고 알린다
 * - `IN_PROGRESS` 생성 중
 */
export type TasteState = "EMPTY" | "DISTRIBUTION_ONLY" | "READY" | "FRESH" | "STALE" | "IN_PROGRESS";

/**
 * 생성 시도가 어떻게 됐나.
 *
 * `FALLBACK` 은 **실패가 아니다** — 외부 생성이 안 돼서 백엔드가 규칙 기반 문장으로 대신 채운
 * 것이고, 응답의 `report.aiGenerated` 가 그걸 구분해 준다. 다시 눌러 볼 수 있다(`canRetry`).
 */
export type TasteGenerationStatus = "NOT_REQUESTED" | "INELIGIBLE" | "IN_PROGRESS" | "GENERATED" | "FALLBACK";

/** 리포트 깊이. 유효한 좋아요 곡 10~29개면 `INITIAL`, 30개 이상이면 `STANDARD` */
export type TasteReportLevel = "INITIAL" | "STANDARD";

export interface TasteCounts {
  totalLiked: number;
  /** 좌표가 있어 분석에 쓴 곡 수 */
  valid: number;
  excluded: number;
  /** 왜 빠졌는지 → 몇 곡인지. 지금 오는 열쇠는 `MISSING_OR_INVALID_LOCATION` 하나다 */
  exclusions: Record<string, number>;
}

export interface TasteEligibility {
  eligible: boolean;
  /** 못 만드는 상태면 `null` 이다 */
  level: TasteReportLevel | null;
  /** 리포트까지 몇 곡을 더 좋아요해야 하나 */
  additionalLikesNeeded: number;
}

/** 리포트 문장 하나. `evidence` 는 그 문장이 어느 수치에서 나왔는지다 */
export interface TasteNarrative {
  findingId: string;
  text: string;
  evidence: string;
}

export interface TasteReport {
  level: TasteReportLevel;
  /** 외부 생성 문장인가. `false` 면 백엔드가 규칙으로 채운 대체 문장이다 */
  aiGenerated: boolean;
  /** 지금 좋아요 목록과 같은 기준으로 만든 것인가 */
  fresh: boolean;
  summary: string;
  narratives: TasteNarrative[];
  /** ISO 8601 (오프셋 포함) */
  analyzedAt: string;
  generatedAt: string;
  lastRefreshedAt: string;
}

export interface TasteGeneration {
  status: TasteGenerationStatus;
  generatedThisRequest: boolean;
  /** 오늘 몫을 이미 썼나. 생성은 하루 한 번이다 */
  dailyLimitUsedToday: boolean;
  canRetry: boolean;
  /** `FALLBACK` 일 때 왜 실패했는지 (백엔드 GMS 오류 코드) */
  failureCode: string | null;
  /** 다시 만들 수 있게 되는 시각. ISO 8601 */
  nextAvailableAt: string | null;
}

/** 축 이름표. `status` 가 `UNLABELED` 면 문장에 쓸 말이 없는 축이다 */
export interface TasteAxisLabel {
  status: string;
  strength: string;
  low: string;
  high: string;
  evidence: string;
}

/**
 * 축 하나의 통계. **이번 화면은 안 쓴다** (S15P21A405-630 제외 범위) — 사분위·히스토그램
 * 시각화는 다음 작업이고, 계약이 어긋나지 않게 타입만 맞춰 둔다.
 */
export interface TasteAxisStatistics {
  pc: number;
  raw: { min: number; q1: number; median: number; q3: number; max: number };
  percentile: { min: number; q1: number; median: number; q3: number; max: number; iqr: number };
  histogram: number[];
  explainedVariance: number;
  label: TasteAxisLabel;
}

/** 분석에 쓴 곡 하나와 그 16차원 좌표 */
export interface TastePoint {
  musicId: number;
  title: string;
  artist: string | null;
  coordinates: number[];
}

export interface TasteAnalysis {
  state: TasteState;
  counts: TasteCounts;
  reportEligibility: TasteEligibility;
  analysisVersion: string;
  axes: TasteAxisStatistics[];
  points: TastePoint[];
  /** 아직 한 번도 안 만들었으면 `null` */
  report: TasteReport | null;
  generation: TasteGeneration;
}
