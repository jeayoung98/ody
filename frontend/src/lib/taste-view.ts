import type { TasteAnalysis, TasteAxisStatistics, TasteFinding, TasteReport, TasteReportLevel } from "@/types";

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
  /** 요약 옆 배지. 표본이 적은 INITIAL 리포트에만 붙는다. `null` 이면 안 붙인다 */
  badge: TasteBadge | null;
  /** 요약 아래 태그 줄. 비어 있으면 줄 자체를 안 그린다 */
  tags: TasteTag[];
}

export interface TasteBadge {
  text: string;
  /** 마우스를 올리면 뜨는 설명 */
  title: string;
}

/**
 * 태그 하나 — 판정 하나에서 나온다.
 *
 * `strength` 는 색이다. `CONSISTENT_BIAS`·`DIVERSE` 는 뚜렷한 취향이라 진하게, `BIAS`·`BALANCED` 는
 * 옅게. 세기 숫자(effectSize)를 그대로 보이지는 않는다 — 사용자는 0.3 과 0.5 의 차이를 모른다.
 */
export interface TasteTag {
  id: string;
  /** `#` 을 포함한 표시 문구 */
  text: string;
  strength: "strong" | "mild";
  /** 마우스를 올리면 뜨는 근거 */
  title: string;
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
  /**
   * 지난 시도가 **아무것도 남기지 못했다** (S15P21A405-647). 대체 문장조차 없이 끝난 행이라
   * 보여 줄 리포트가 없다 — 그냥 빈 칸으로 두면 눌러 본 적이 없는 것과 구별이 안 된다.
   */
  lastFailed: "지난번에는 만들지 못했어요. 다시 해 볼 수 있어요.",
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
    badge: report ? tasteBadge(report.level) : null,
    tags: report ? tasteTags(report.findings ?? [], analysis.axes) : [],
  };
}

/**
 * 표본이 적다는 말은 **문장이 아니라 배지**로 (S15P21A405-634·639).
 *
 * 예전에는 백엔드가 INITIAL 요약 앞에 "현재 좋아요에서 보이는 잠정 경향으로, " 를 붙였다. 그러면
 * 요약이 "나를 설명하는 한 문장" 이 아니라 면책 문구가 된다. 빼 달라고 해서 빠졌고, 그 자리를 이 배지가
 * 맡는다. 30곡부터는 붙일 것이 없다.
 */
export function tasteBadge(level: TasteReportLevel): TasteBadge | null {
  if (level !== "INITIAL") return null;
  return { text: "잠정", title: "좋아요 10~29곡으로 읽은 경향이에요. 30곡부터 표준 리포트가 돼요." };
}

/**
 * 판정 → 태그 (S15P21A405-639). 백엔드가 세기 순으로 내려 준 순서를 그대로 쓴다.
 *
 * - 기운 축(`LOW`/`HIGH`): 그 극의 말에 " 곡" — `#어두운 곡`. 백엔드가 태그 어형(`lowTag`/`highTag`)을
 *   주면 그걸 그대로 쓴다 (아직 없다, A-54 ④)
 * - 폭넓은 축(`BOTH`): 축 이름으로 `#밝기 폭넓음`. 축 이름이 없으면 양 끝을 잇는다 — `#어두운 · 밝은 폭넓음`
 * - 고른 취향(`CENTER`): `#고른 취향`
 */
export function tasteTags(findings: TasteFinding[], axes: TasteAxisStatistics[]): TasteTag[] {
  const labelOf = (pc: number | null) => (pc == null ? null : axes.find((a) => a.pc === pc)?.label ?? null);
  return findings.map((f) => {
    const label = labelOf(f.pc);
    const strength: TasteTag["strength"] = f.type === "CONSISTENT_BIAS" || f.type === "DIVERSE" ? "strong" : "mild";
    let text: string;
    if (f.direction === "CENTER") {
      text = "#고른 취향";
    } else if (f.direction === "BOTH") {
      const [low, high] = f.axisPhrase.split(" / ");
      text = label?.axis ? `#${label.axis} 폭넓음` : `#${low} · ${high ?? low} 폭넓음`;
    } else {
      const given = f.direction === "LOW" ? label?.lowTag : label?.highTag;
      text = `#${given ?? `${f.axisPhrase} 곡`}`;
    }
    return { id: f.id, text, strength, title: `${TYPE_TITLE[f.type] ?? f.type} · ${f.evidence}` };
  });
}

const TYPE_TITLE: Record<string, string> = {
  CONSISTENT_BIAS: "한쪽으로 뚜렷하게 모여 있어요",
  BIAS: "한쪽으로 기울어 있지만 폭도 있어요",
  DIVERSE: "양 끝을 다 들어요",
  BALANCED: "어느 쪽으로도 튀지 않아요",
};

function noticeOf(analysis: TasteAnalysis, generating: boolean, stale: boolean): string | null {
  const { state, report, reportEligibility: eligibility, generation } = analysis;
  // 순서가 뜻이다 — 지금 벌어지는 일 > 못 하는 이유 > 권하는 일 > 곁들이는 말
  if (generating) return TASTE_NOTICE.generating;
  if (state === "EMPTY") return TASTE_NOTICE.empty;
  if (!eligibility.eligible) return TASTE_NOTICE.needMore(Math.max(1, eligibility.additionalLikesNeeded));
  if (generation.dailyLimitUsedToday) return TASTE_NOTICE.dailyLimit;
  if (stale) return TASTE_NOTICE.stale;
  if (report && !report.aiGenerated) return TASTE_NOTICE.fallback;
  /**
   * 리포트는 없는데 실패 코드만 온 경우 (S15P21A405-647). 백엔드가 "마지막 시도가 실패였다" 를
   * 조회에도 실어 주기 시작했다 — 보여 줄 글이 없어도 **눌렀다는 사실은 남아야** 한다.
   */
  if (!report && generation.failureCode) return TASTE_NOTICE.lastFailed;
  return null;
}
