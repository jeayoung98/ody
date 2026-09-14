/**
 * JS(canvas) 에서 필요한 디자인 토큰. CSS 원본은 src/styles/tokens.css.
 * 값이 바뀌면 양쪽을 함께 고친다.
 */

/** 장르 팔레트. 인덱스 = genreId (constants/map.ts GENRE_NAMES 와 같은 순서) */
export const GENRE_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [79, 227, 206], // 앰비언트
  [56, 198, 255], // 일렉트로닉
  [134, 169, 255], // 클래식
  [160, 140, 255], // 재즈
  [185, 120, 255], // 힙합
  [224, 112, 232], // R&B·소울
  [255, 123, 176], // 팝
  [255, 139, 107], // 록
  [255, 92, 122], // 메탈
  [123, 227, 156], // 포크·컨트리
  [126, 138, 158], // 무장르 — 장르 정보가 없는 곡. 채도를 뺀 회청색이라 "값이 없다"로 읽힌다
];

/**
 * 팔레트 인덱스. 팔레트 밖 genreId(미정 장르·음수)가 와도 배열 밖을 짚지 않는다.
 * 스프라이트 배열도 GENRE_COLORS 와 길이가 같으므로 색·스프라이트 모두 이 함수로 고른다.
 */
export function genreIdx(genreId: number): number {
  return Math.abs(genreId) % GENRE_COLORS.length;
}

export function genreRgb(genreId: number): readonly [number, number, number] {
  return GENRE_COLORS[genreIdx(genreId)];
}

export function rgba(rgb: readonly [number, number, number], a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

export function genreColor(genreId: number): string {
  return rgba(genreRgb(genreId), 1);
}

export const PALETTE = {
  void: "#04060d",
  void2: "#070b16",
  ink: "#e9f1ff",
  ink2: "#93a4c4",
  ink3: "#586a8b",
  ink4: "#3a4761",
  teal: "#4fe3ce",
  azure: "#5c9dff",
  violet: "#a67cff",
  warn: "#ffc46b",
  bad: "#ff7a8a",
} as const;

export const MAP_COLORS = {
  background: PALETTE.void,
  me: PALETTE.teal,
  meRing: "rgba(79,227,206,.55)",
  meRingInner: "rgba(79,227,206,.28)",
  /**
   * 지금 듣는 곡이 **이 겹에 없을 때**의 내 표식 (MAP-08). 청록이면 "여기 있다"로 읽히므로
   * 다른 색을 쓴다 — 고스트별과 같은 보라 계열이라 "이 겹 밖"이 같은 언어로 전달된다.
   */
  meAway: "rgba(166,124,255,.95)",
  meAwayRing: "rgba(166,124,255,.5)",
  meAwayRingInner: "rgba(166,124,255,.26)",
  nearbyLine: "rgba(79,227,206,.28)",
  nearbyNode: "rgba(150,180,240,.42)",
  probeDim: "rgba(4,6,13,.88)",
  routeStops: ["rgba(79,227,206,.95)", "rgba(92,157,255,.95)", "rgba(166,124,255,.95)"],
  stationFill: "#060a14",
  stationStroke: "rgba(233,241,255,.85)",
  stationCurrent: PALETTE.teal,
  labelBg: "rgba(6,10,19,.82)",
  core: "#f2f7ff",
} as const;

/** 배경 성운 워시 — 화면 비율 좌표(u,v), 반지름 비율, 색 */
export const NEBULA_WASH: ReadonlyArray<{ u: number; v: number; r: number; c: readonly [number, number, number] }> = [
  { u: 0.16, v: 0.2, r: 0.92, c: [44, 102, 214] },
  { u: 0.8, v: 0.16, r: 0.74, c: [92, 157, 255] },
  { u: 0.66, v: 0.8, r: 0.98, c: [112, 66, 206] },
  { u: 0.18, v: 0.84, r: 0.8, c: [33, 140, 162] },
  { u: 0.5, v: 0.48, r: 1.2, c: [70, 84, 198] },
  { u: 0.92, v: 0.55, r: 0.66, c: [150, 90, 235] },
];

export const FONTS = {
  body: '"IBM Plex Sans KR",system-ui,sans-serif',
  mono: '"IBM Plex Mono",ui-monospace,monospace',
  display: '"Familjen Grotesk","IBM Plex Sans KR",sans-serif',
} as const;
