/** 우측 패널 종류 */
export const PANEL_TYPES = ["song", "playlist", "feed", "journey", "friends", "chart"] as const;
export type PanelType = (typeof PANEL_TYPES)[number];

/** 맵 뷰 모드 */
/** 맵 뷰 모드. 별자리는 뷰 모드가 아니라 독립 오버레이(스토어 constellation*) */
export const MAP_VIEW_MODES = ["default", "nearby"] as const;
export type MapViewMode = (typeof MAP_VIEW_MODES)[number];

/** 네비바 항목 (순서대로 표시) */
export const NAV_ITEMS = [
  { key: "friends", label: "주변 사람" },
  { key: "journey", label: "여정" },
  { key: "chart", label: "차트" },
  { key: "feed", label: "내 프로필" },
] as const satisfies ReadonlyArray<{ key: PanelType; label: string }>;
