import type { TasteAnalysis, TasteReport } from "@/types";

/**
 * 취향 분석 응답 하나를 **화면이 물어보는 것들**로 바꾼다 (S15P21A405-630).
 *
 * 백엔드는 `state`(6가지)·`reportEligibility`·`generation` 셋으로 상황을 말하는데, 화면이
 * 알아야 하는 것은 **무엇을 띄우고, 버튼을 눌러도 되고, 뭐라고 적을까** 셋뿐이다. 그 변환을
 * 컴포넌트 안에 두면 조건이 JSX 사이에 흩어져서 어느 상태가 빠졌는지 알 수 없다.
 */
export interface TasteView {
  /** 보여 줄 리포트. `null` 이면 아직 만든 적이 없다 */
  report: TasteReport | null;
  /** 좋아요 목록이 그 뒤로 바뀌었나. 리포트는 그대로 보여 주되 다시 만들기를 권한다 */
  stale: boolean;
  /** 지금 만들고 있나 */
  generating: boolean;
  /** 생성 버튼을 눌러도 되나 */
  canGenerate: boolean;
  buttonLabel: string;
  /** 버튼 옆/밑 한 줄. `null` 이면 적을 말이 없다 */
  notice: string | null;
}

/**
 * 안내 문구.
 *
 * 나누는 기준은 **사용자가 할 일이 다른가**다 — 곡을 더 좋아요하거나, 기다리거나, 내일 오거나,
 * 다시 만들거나. 한 문구로 합치면 그중 하나는 거짓말이 된다.
 */
export const TASTE_NOTICE = {
  empty: "좋아요한 곡이 아직 없어요. 마음에 드는 곡을 모으면 취향을 읽어 드릴게요.",
  needMore: (n: number) => `${n}곡 더 좋아요하면 취향 리포트를 만들 수 있어요.`,
  generating: "리포트를 만들고 있어요. 조금만 기다려 주세요.",
  dailyLimit: "오늘 몫을 다 썼어요. 내일 다시 만들 수 있어요.",
  stale: "좋아요한 곡이 바뀌었어요. 다시 만들면 지금 취향에 맞춰집니다.",
  /** 외부 생성이 안 돼서 백엔드가 규칙으로 채운 문장이다. 실패가 아니라 **덜 다듬어진 것**이다 */
  fallback: "이번에는 간단한 요약으로 대신했어요.",
} as const;

export function tasteView(analysis: TasteAnalysis): TasteView {
  const { state, report, reportEligibility: eligibility, generation } = analysis;
  const generating = state === "IN_PROGRESS";
  const stale = state === "STALE";
  const canGenerate = eligibility.eligible && !generating && !generation.dailyLimitUsedToday;

  return {
    report,
    stale,
    generating,
    canGenerate,
    buttonLabel: report ? "다시 만들기" : "리포트 만들기",
    notice: noticeOf(analysis, generating, stale),
  };
}

function noticeOf(analysis: TasteAnalysis, generating: boolean, stale: boolean): string | null {
  const { state, report, reportEligibility: eligibility, generation } = analysis;
  // 순서가 뜻이다 — 지금 벌어지는 일 > 못 하는 이유 > 권하는 일 > 곁들이는 말
  if (generating) return TASTE_NOTICE.generating;
  if (state === "EMPTY") return TASTE_NOTICE.empty;
  if (!eligibility.eligible) return TASTE_NOTICE.needMore(Math.max(1, eligibility.additionalLikesNeeded));
  if (generation.dailyLimitUsedToday) return TASTE_NOTICE.dailyLimit;
  if (stale) return TASTE_NOTICE.stale;
  if (report && !report.aiGenerated) return TASTE_NOTICE.fallback;
  return null;
}
