/**
 * 반응하기 기본 이모지 세트 (SOCIAL-02).
 *
 * `key` 는 서버로 그대로 나간다 — 백엔드 `ReactionRequest.reactionKey` 가 `^[a-z_]{1,32}$` 만
 * 받는다. 목록은 프론트가 소유하고, 받는 쪽이 모르는 키는 ✨ 로 그린다 (`floating-reaction-item`).
 */
export const REACTIONS = [
  { key: "rocket", emoji: "🚀", label: "출발" },
  { key: "fire", emoji: "🔥", label: "불" },
  { key: "heart", emoji: "💓", label: "하트" },
  { key: "poop", emoji: "💩", label: "응" },
  { key: "pray", emoji: "🙏", label: "기도" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];

/** 키 → 이모지. 서버를 거쳐 온 모르는 키는 ✨ 로 그린다 */
export const emojiOf = (key: string) => REACTIONS.find((r) => r.key === key)?.emoji ?? "✨";

/** 화면에 반응이 떠 있는 시간(ms) */
export const REACTION_VISIBLE_MS = 2_000;
