/**
 * 차트(랭킹) 종류 (SOCIAL-12).
 *
 * **백엔드가 내려주는 것을 기준으로 다시 짰다** (S15P21A405-604). 배포된 `GET /api/stats/weekly`
 * (S15P21A405-448) 는 이번 주 **발견왕·탐험왕·기여도** top 10 을 한 번에 준다. 명세의 4종
 * (버스기사·탐험왕·누적 팔로워·탑 플레이리스트) 중 탐험왕만 겹치고, 누적 팔로워·탑 플리는
 * 백엔드에 없어서 **목 탭을 걷어냈다** — 목을 실데이터로 알고 보는 일이 없어야 한다 (BACKEND-NOTES A-71).
 * 실시간 탑 버스기사는 `GET /api/realtime/ride/ranking` 이 따로 준다 (S15P21A405-681, 백엔드 678).
 *
 * `unit` 은 `UserRankingItem.score` 의 뜻이다 — 종류마다 다르다 (발견한 곡 수 / 재생 횟수 / 신고 건수 /
 * 지금 태우고 있는 인원). 버스기사를 "동승" 이라 적으면 누적으로 읽혀서 "명" 이다.
 * `empty` 는 빈 목록 문구. 버스기사는 **빈 목록이 기본 상태에 가깝다** — 아무도 안 태우면 `[]` 다.
 *
 * **화면 이름은 "선장" 이다** (S15P21A405-720, 사용자 결정). 명세(SOCIAL-12)와 이 파일의 주석·키(`topDriver`)는
 * "버스기사" 그대로다 — 화면 글자만 바꿨다. 탑승이 우주선을 타는 것이라 빈 목록도 "우주선" 이다.
 */
export const CHART_TYPES = [
  { key: "discovery", label: "이번주 발견왕", short: "발견왕", unit: "곡", description: "이번 주 처음 재생된 곡을 가장 많이 찾아낸 사람", empty: "이번 주에는 아직 기록이 없어요." },
  { key: "explore", label: "이번주 탐험왕", short: "탐험왕", unit: "회", description: "이번 주 재생 횟수가 가장 많은 사람 (같은 곡을 다시 들어도 센다)", empty: "이번 주에는 아직 기록이 없어요." },
  { key: "contribution", label: "이번주 기여도", short: "기여도", unit: "건", description: "이번 주 잘못된 곡을 가장 많이 신고한 사람", empty: "이번 주에는 아직 기록이 없어요." },
  { key: "topDriver", label: "실시간 탑 선장", short: "선장", unit: "명", description: "지금 가장 많은 사람을 태우고 있는 사람", empty: "지금 운행 중인 우주선이 없어요." },
] as const;
export type ChartType = (typeof CHART_TYPES)[number]["key"];

/** 주간 통계 응답에 실제로 들어 있는 종류 — `WeeklyRanking` 의 키와 같다 */
export type WeeklyChartType = Exclude<ChartType, "topDriver">;

/**
 * 실시간 탑 버스기사 조회 (S15P21A405-681).
 *
 * - `limit` — 화면이 10줄이라 BFF 가 박아 둔다. 백엔드는 1~10 밖이면 400
 * - `staleMs` — 서버가 같은 답을 2초 들고 있다. 그보다 짧게 들고 있어도 새 값이 안 온다
 * - `refreshCooldownMs` — 새로고침을 누른 뒤 막아 두는 시간. 서버 캐시(2초)보다 길게 둔다
 * - `agoTickMs` — "방금" · "1분 전" 을 다시 적는 주기
 */
export const TOP_DRIVER = {
  limit: 10,
  staleMs: 2_000,
  refreshCooldownMs: 3_000,
  agoTickMs: 30_000,
} as const;
