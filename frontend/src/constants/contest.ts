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

/**
 * 모양 일치도 — 서버 enum 을 **숫자 없이** 사람 말로 (S15P21A405-693). `LOW` 는 실패가 아니라 경고다.
 *
 * 예전에는 `닮음 높음 · 92`·`정확도 · 100` 처럼 숫자를 같이 적었는데, 출품 뒤 AI 점수도 100점 만점이라
 * 둘이 같은 점수로 읽혔다. 화면의 숫자 점수는 AI 점수 하나만 남기고, 이건 말로만 적는다.
 */
export const MATCH_QUALITY_LABEL: Record<MatchQuality, string> = {
  HIGH: "그린 모양과 잘 맞아요",
  MEDIUM: "그린 모양과 대체로 비슷해요",
  LOW: "그린 모양과 꽤 달라요",
};

/** 그리기 탭 진행 단계 (S15P21A405-693). 순서가 곧 화면의 단계 표시 순서다 */
export const SKETCH_STEPS = [
  { key: "draw", label: "그리기" },
  { key: "review", label: "곡 확인" },
  { key: "submit", label: "이름 짓고 출품" },
  { key: "scoring", label: "AI 채점" },
] as const;
export type SketchStep = (typeof SKETCH_STEPS)[number]["key"];

/** 스케치 캔버스 — 점을 다시 눌러 빼는 판정 반경(px) */
export const SKETCH_HIT_PX = 12;

/** 플레이어바에 "이벤트 N위" 태그를 붙이는 순위 상한 (S15P21A405-684) */
export const CONTEST_TOP = 5;

/** 플레이어바 태그 문구 */
export const CONTEST_RANK_TAG = (rank: number) => `🏆 이벤트 ${rank}위`;
