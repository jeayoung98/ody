/** 반응하기 기본 이모지 세트. 앱 기능과 연관된 표정들 */
export const REACTIONS = [
  { key: "fire", emoji: "🔥", label: "불" },
  { key: "board", emoji: "🚌", label: "탑승" },
  { key: "friend", emoji: "🤝", label: "친구하기" },
  { key: "wave", emoji: "👋", label: "인사" },
  { key: "star", emoji: "⭐", label: "별" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];

/** 동일 사용자에게 재전송 가능한 최소 간격(ms) */
export const REACTION_COOLDOWN_MS = 5_000;

/** 화면에 반응이 떠 있는 시간(ms) */
export const REACTION_VISIBLE_MS = 2_000;

/**
 * 목 데이터 전용 — 지도에 떠 있는 다른 사용자가 스스로 반응을 쏘는 간격(ms).
 * 실서비스에서는 소켓 이벤트(`user:reaction`)가 이 자리를 대신한다.
 */
export const MOCK_FRIEND_REACTION_INTERVAL_MS = 4_200;
