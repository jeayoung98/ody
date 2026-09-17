/** 우측 패널 종류 */
export const PANEL_TYPES = ["song", "playlist", "feed", "journey", "friends", "chart"] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

/** 맵 뷰 모드 */
/** 맵 뷰 모드. 셋은 배타다 — 기본 / 주변 탐색 / 별자리 (PATH-01-1) */
export const MAP_VIEW_MODES = ["default", "nearby", "constellation"] as const;
export type MapViewMode = (typeof MAP_VIEW_MODES)[number];

/** 네비바 항목 (순서대로 표시) */
export const NAV_ITEMS = [
  { key: "friends", label: "주변 사람" },
  { key: "journey", label: "여정" },
  { key: "chart", label: "차트" },
  { key: "feed", label: "내 프로필" },
] as const satisfies ReadonlyArray<{ key: PanelType; label: string }>;

/**
 * 접혀 있을 때 화면에 남겨 두는 몸통 폭(px) — **좌하단 계기판이 쓴다** (S15P21A405-406).
 *
 * 완전히 밀어 넣으면 화살표 핸들만 남아서, 거기에 무엇이 있었는지가 안 읽힌다.
 * 몸통을 조금 남기면 "끌어내면 다시 볼 것이 있다" 가 모양으로 보인다.
 *
 * 우측 패널은 이 값을 쓰지 않는다 — 그쪽은 레일이 옆에 있어서 **핸들을 레일 왼쪽에 붙이는
 * 자리**로 따로 잡는다 (`right-panel.tsx`). 남길 폭이 아니라 맞출 자리가 기준이다.
 */
export const COLLAPSED_PEEK_PX = 28;
