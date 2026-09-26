import type { ContestSort, MatchQuality } from "@/types";

/**
 * 별자리 콘테스트 (S15P21A405-602 · 640).
 *
 * 그리기 규칙은 백엔드 `DrawRequest`(점 3~20개)와 같다 — 화면이 먼저 막고, 넘기면 서버가 400 `INVALID_INPUT` 이다.
 * 표 한도(`voteLimit`)는 회차마다 서버가 내려 주므로 여기 없다.
 */
export const SKETCH_RULES = {
  minPoints: 3,
  maxPoints: 20,
  /** 별자리 이름 = 플레이리스트 이름. 백엔드 플리 이름 제한과 별개로 화면에서 자르는 길이 */
  titleMax: 30,
} as const;

/** 리더보드를 한 번에 받는 수. 서버 상한이 50 이다 (BACKEND-NOTES §6-4) */
export const CONTEST_LEADERBOARD_SIZE = 50;

/** 내 작품이 `PENDING` 이면 이 간격으로 다시 읽는다. 서버 채점 스케줄러가 5초 주기다 (§6-2) */
export const CONTEST_SCORING_POLL_MS = 5000;

export const CONTEST_TABS = [
  { key: "sketch", label: "별자리 그리기" },
  { key: "gallery", label: "갤러리" },
  { key: "ranking", label: "순위" },
] as const;
export type ContestTab = (typeof CONTEST_TABS)[number]["key"];

export const CONTEST_SORTS = [
  { key: "rank", label: "순위순" },
  { key: "latest", label: "최신순" },
  { key: "likes", label: "좋아요순" },
  { key: "ai", label: "AI 점수순" },
] as const satisfies ReadonlyArray<{ key: ContestSort; label: string }>;

/** 모양 일치도 등급 — 서버 enum 을 사람 말로. `LOW` 는 실패가 아니라 경고다 */
export const MATCH_QUALITY_LABEL: Record<MatchQuality, string> = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" };

/** 스케치 캔버스 — 점을 다시 눌러 빼는 판정 반경(px) */
export const SKETCH_HIT_PX = 12;

/**
 * 이벤트 탑 작품을 지도에 띄우는 규칙 (S15P21A405-684).
 *
 * 작품 곡은 pc1/pc2 평면에서 고른 것이라(백엔드 `CatPlaylistGenerator`) **최상단 겹(pc1/pc2 축)에서만** 그린 모양이 나온다.
 * 다른 겹은 축이 달라 모양이 흩어지므로 그리지 않는다.
 */
export const CONTEST_SKY = {
  /** 몇 위까지 띄우나 */
  top: 5,
  /** 그리는 겹. pc1/pc2 를 x·y 로 쓰는 겹이어야 한다 */
  layer: 0,
  /** 선·점을 누른 것으로 치는 거리(px) */
  hitPx: 10,
  /** 순위 태그 — 모양 맨 위 점에서 위로 띄우는 거리·높이·최대 너비(px) */
  tagGapPx: 14,
  tagHeightPx: 22,
  tagMaxWidthPx: 180,
  tagPadXPx: 8,
  tagFontPx: 12,
  /** 선 굵기(px)·점 반지름(px) */
  lineWidthPx: 1.6,
  dotRadiusPx: 2.6,
} as const;

/** 작품에 플리 번호가 아직 없을 때 (리더보드 응답에 `playlistId` 가 오기 전) */
export const CONTEST_SKY_UNPLAYABLE = "이 작품의 플레이리스트를 아직 틀 수 없어요.";

/** 플레이어바 태그 문구 */
export const CONTEST_RANK_TAG = (rank: number) => `🏆 이벤트 ${rank}위`;
