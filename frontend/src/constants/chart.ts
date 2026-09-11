/** 차트(랭킹) 종류 */
export const CHART_TYPES = [
  { key: "topDriver", label: "실시간 탑 버스기사", description: "따라가기가 가장 많은 사람" },
  { key: "topExplorer", label: "이번주 탐험왕", description: "이번 주 가장 많은 곡을 탐험한 사람" },
  { key: "topFollowed", label: "누적 팔로워", description: "누적 팔로워 수가 가장 많은 사람" },
  { key: "topPlaylist", label: "탑 플레이리스트", description: "오늘 기준 일주일치 좋아요" },
] as const;
export type ChartType = (typeof CHART_TYPES)[number]["key"];
