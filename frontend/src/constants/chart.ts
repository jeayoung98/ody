/**
 * 차트(랭킹) 종류 (SOCIAL-12).
 *
 * **백엔드가 내려주는 것을 기준으로 다시 짰다** (S15P21A405-604). 배포된 `GET /api/stats/weekly`
 * (S15P21A405-448) 는 이번 주 **발견왕·탐험왕·기여도** top 10 을 한 번에 준다. 명세의 4종
 * (버스기사·탐험왕·누적 팔로워·탑 플레이리스트) 중 탐험왕만 겹치고, 누적 팔로워·탑 플리는
 * 백엔드에 없어서 **목 탭을 걷어냈다** — 목을 실데이터로 알고 보는 일이 없어야 한다 (BACKEND-NOTES A-71).
 * 실시간 탑 버스기사는 명세에 있지만 아직 없어서 "준비 중" 으로만 남긴다.
 *
 * `unit` 은 `RankedUser.count` 의 뜻이다 — 종류마다 다르다 (발견한 곡 수 / 재생 횟수 / 신고 건수).
 */
export const CHART_TYPES = [
  { key: "discovery", label: "이번주 발견왕", short: "발견왕", unit: "곡", description: "이번 주 처음 재생된 곡을 가장 많이 찾아낸 사람" },
  { key: "explore", label: "이번주 탐험왕", short: "탐험왕", unit: "회", description: "이번 주 재생 횟수가 가장 많은 사람 (같은 곡을 다시 들어도 센다)" },
  { key: "contribution", label: "이번주 기여도", short: "기여도", unit: "건", description: "이번 주 잘못된 곡을 가장 많이 신고한 사람" },
  { key: "topDriver", label: "실시간 탑 버스기사", short: "버스기사", unit: "동승", description: "따라가기가 가장 많은 사람" },
] as const;
export type ChartType = (typeof CHART_TYPES)[number]["key"];

/** 주간 통계 응답에 실제로 들어 있는 종류 — `WeeklyRanking` 의 키와 같다 */
export type WeeklyChartType = Exclude<ChartType, "topDriver">;

/** 아직 백엔드가 없는 종류. 목으로 채우지 않고 "준비 중" 을 보인다 */
export const CHART_PENDING: ReadonlySet<ChartType> = new Set<ChartType>(["topDriver"]);
