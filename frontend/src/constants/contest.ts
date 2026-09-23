import type { ContestSort } from "@/types";

/**
 * 별자리 콘테스트 (S15P21A405-602).
 *
 * 규칙 값(점 개수·표 수·재출품 횟수·AI 기준)은 **서버가 회차마다 내려준다** (`Contest.rules`).
 * 여기 있는 것은 목이 쓰는 기본값과, 화면 구성처럼 서버와 무관한 것만이다.
 */
export const CONTEST_DEFAULT_RULES = {
  minPoints: 3,
  maxPoints: 20,
  resubmitLimit: 3,
  voteLimit: 3,
  aiGate: 30,
  titleMax: 30,
} as const;

export const CONTEST_TABS = [
  { key: "sketch", label: "별자리 그리기" },
  { key: "gallery", label: "갤러리" },
  { key: "ranking", label: "순위" },
] as const;
export type ContestTab = (typeof CONTEST_TABS)[number]["key"];

export const CONTEST_SORTS = [
  { key: "latest", label: "최신순" },
  { key: "votes", label: "표 많은 순" },
  { key: "ai", label: "AI 점수순" },
  { key: "final", label: "최종 점수순" },
  { key: "saves", label: "많이 가져간 순" },
] as const satisfies ReadonlyArray<{ key: ContestSort; label: string }>;

/** 매칭 품질 라벨 — 서버 enum 을 사람 말로 */
export const MATCH_QUALITY_LABEL = { HIGH: "높음", MID: "보통", LOW: "낮음" } as const;

/** 스케치 캔버스 — 점을 다시 눌러 빼는 판정 반경(px) */
export const SKETCH_HIT_PX = 12;
