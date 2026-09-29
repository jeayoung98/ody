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
  void: "#02040a",
  void2: "#05080f",
  ink: "#e9f1ff",
  ink2: "#93a4c4",
  ink3: "#7688a8",
  ink4: "#586c93",
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

/**
 * 겹마다 배경 성운 워시를 물들이는 색 (S15P21A405-690). 인덱스 = 겹 번호. 배경만 보고도 겹이 갈리게 하려는 것이다.
 *
 * **곡 별 색(장르)은 건드리지 않는다.** 물드는 것은 배경 성운 빛뿐이고 그 빛은 원래 밝기 0.1 남짓이라,
 * 장르 색 채널과 부딪히지 않을 만큼만 섞는다(`LAYER_TINT_MIX`). `LAYER_DEPTH` 가 "배경 색은 건드리지 않는다" 고
 * 정해 둔 것을 이 한 곳에서만 푼다 — 더 세게 섞고 싶으면 장르 색과 겹쳐 보이는지부터 본다.
 */
/**
 * **이웃한 겹은 확실히 다른 색이다** — 파랑 다음 보라처럼 가까운 색을 이으면 겹을 옮겨도 바뀐 줄 모른다.
 * 차가운 색과 따뜻한 색을 번갈아 두고, 이웃끼리 색상(hue)이 70° 넘게 벌어지게 골랐다 (가장 가까운 쌍이 자홍→호박 71°). 떨어진 겹끼리는 비슷해도 된다.
 */
export const LAYER_TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [70, 110, 235], // 우주 — 짙은 파랑
  [220, 90, 170], // 은하단 — 자홍
  [210, 160, 95], // 우리은하 — 은하 중심의 호박색
  [150, 90, 240], // 성운 — 보라
  [80, 200, 230], // 성단 — 하늘색
  [240, 140, 55], // 태양계 — 주황
  [70, 205, 150], // 행성 — 청록
  [235, 110, 140], // 저궤도 — 장밋빛
];
/** 워시 원래 색에 겹 색을 섞는 비율 (0 = 그대로, 1 = 겹 색만). 0.6 이었다 — 겹이 바뀐 줄 모른다는 피드백으로 올렸다 (S15P21A405-723) */
export const LAYER_TINT_MIX = 0.85;

/** 상주 별 스프라이트 모양 (S15P21A405-723). 겹마다 하나씩 골라 "다른 곳에 왔다" 가 별 자체에서 읽히게 한다 */
export type StarShape = "halo" | "cross" | "smear" | "diffuse" | "point" | "disc" | "spark";

/**
 * 성운 구름 스타일 (S15P21A405-723). `count` 0 이면 그 겹은 구름이 없다.
 * `stretch` 는 가로/세로 비 — 1 이 둥근 뭉게, 2.5 는 옆으로 길게 깔린 띠.
 */
export interface CloudStyle {
  count: number;
  scale: number;
  alpha: number;
  stretch: number;
}

/**
 * **겹별 하늘 테마** (S15P21A405-723). 겹을 옮겨도 바뀐 게 없다는 피드백에 대한 답이다 — 하늘 색·별 모양·구름을
 * 겹마다 다르게 해서 같은 하늘을 확대한 것과 구별되게 한다. 인덱스 = 겹 번호.
 *
 * - `sky`: 배경에 깔리는 세로 그라데이션 [위, 아래]. `LAYER_SKY_ALPHA` 만큼 검은 바탕 위에 덮는다.
 * - `star`: 그 겹 상주 별의 스프라이트 모양. **색은 여전히 장르다** — 모양만 바뀐다.
 * - `cloud`: 성운 퍼프 스타일.
 *
 * 하늘 색은 `LAYER_TINTS` 와 같은 계열이다 — 이웃 겹은 색상이 70° 넘게 갈린다(그쪽 주석 참고).
 */
export const LAYER_THEMES: ReadonlyArray<{
  sky: readonly [readonly [number, number, number], readonly [number, number, number]];
  star: StarShape;
  cloud: CloudStyle;
}> = [
  // 우주 — 검정에 가까운 남색. 첫 화면이 서비스의 얼굴이라 튀지 않게 두고, 파고들수록 색이 짙어지게 한다 (사용자 결정)
  { sky: [[4, 8, 26], [1, 2, 7]], star: "halo", cloud: { count: 22, scale: 1.0, alpha: 1.0, stretch: 1 } },
  // 은하단 — 자홍. 십자 빛줄기, 가늘게 뻗은 필라멘트
  { sky: [[42, 10, 44], [7, 3, 15]], star: "cross", cloud: { count: 14, scale: 0.7, alpha: 1.2, stretch: 2.2 } },
  // 우리은하 — 호박색. 옆으로 번진 별, 은하수 띠
  { sky: [[43, 28, 10], [10, 6, 4]], star: "smear", cloud: { count: 18, scale: 1.2, alpha: 0.9, stretch: 2.8 } },
  // 성운 — 보라. 퍼진 뭉게별, 알록달록한 덩어리
  { sky: [[26, 11, 58], [5, 3, 15]], star: "diffuse", cloud: { count: 30, scale: 0.8, alpha: 1.5, stretch: 1 } },
  // 성단 — 하늘색. 작고 날카로운 점, 맑은 밤
  { sky: [[4, 32, 42], [2, 10, 16]], star: "point", cloud: { count: 0, scale: 1, alpha: 0, stretch: 1 } },
  // 태양계 — 주황. 십자 빛줄기(해처럼), 따뜻한 빛무리. 고리 달린 원반은 못생겨서 뺐다 — 은하단과 모양이 겹치지만 색이 갈라 준다 (사용자 결정)
  { sky: [[42, 22, 6], [10, 5, 3]], star: "cross", cloud: { count: 6, scale: 1.6, alpha: 0.6, stretch: 1.2 } },
  // 행성 — 청록. 그늘진 원판, 구름 없음
  { sky: [[4, 36, 28], [2, 12, 9]], star: "disc", cloud: { count: 0, scale: 1, alpha: 0, stretch: 1 } },
  // 저궤도 — 장밋빛. 반짝이는 스파크, 얇게 깔린 연무
  { sky: [[42, 12, 22], [11, 4, 7]], star: "spark", cloud: { count: 10, scale: 1.1, alpha: 0.7, stretch: 3.2 } },
];
/** 하늘 그라데이션을 검은 바탕 위에 덮는 세기. 1 이면 `sky` 색 그대로다 */
export const LAYER_SKY_ALPHA = 0.85;

/** 배경 성운 워시 — 화면 비율 좌표(u,v), 반지름 비율, 색 */
export const NEBULA_WASH: ReadonlyArray<{ u: number; v: number; r: number; c: readonly [number, number, number] }> = [
  { u: 0.16, v: 0.2, r: 0.92, c: [44, 102, 214] },
  { u: 0.8, v: 0.16, r: 0.74, c: [92, 157, 255] },
  { u: 0.66, v: 0.8, r: 0.98, c: [112, 66, 206] },
  { u: 0.18, v: 0.84, r: 0.8, c: [33, 140, 162] },
  { u: 0.5, v: 0.48, r: 1.2, c: [70, 84, 198] },
  { u: 0.92, v: 0.55, r: 0.66, c: [150, 90, 235] },
];

/**
 * 캔버스가 쓰는 폰트. `styles/tokens.css` 의 `--font-*` 와 **같은 값이어야 한다** — 한쪽만
 * 고치면 DOM 글자와 지도 글자가 서로 다른 서체로 갈린다.
 *
 * **셋 다 Pretendard 다** (S15P21A405-538). 이름을 셋으로 남긴 이유는 tokens.css 주석에 있다.
 * 캔버스에는 `tabular-nums` 가 없으므로, 숫자를 세로로 줄 맞춰야 하는 자리는 지금처럼
 * 그리는 쪽에서 자리를 잡아 준다.
 */
const PRETENDARD = '"Pretendard Variable",Pretendard,system-ui,sans-serif';
export const FONTS = {
  body: PRETENDARD,
  mono: PRETENDARD,
  display: PRETENDARD,
} as const;

/**
 * 브레이크포인트 (**CSS 픽셀**). 원본은 `src/styles/tokens.css` 의 `--breakpoint-*` 이고
 * 값이 바뀌면 양쪽을 함께 고친다. `desk` 는 좁은 화면 게이트(globals.css 의 899)와 같은 선이다.
 *
 * **화면을 가르는 것은 CSS 미디어 쿼리 담당이다.** 렌더 분기에 `window.innerWidth` 를 읽지 않는다 —
 * 서버 렌더에는 창 크기가 없어 하이드레이션이 어긋나고, JS 가 뜨기 전 첫 페인트에 잘못된 화면이
 * 그대로 보인다 (S15P21A405-379). 이 상수는 하이드레이션 이후에만 도는 캔버스 엔진처럼
 * **JS 안에서 이미 폭을 재고 있는 곳**이 같은 경계를 쓰려고 참조한다.
 */
export const BREAKPOINTS = {
  tablet: 900,
  desk: 900,
} as const;

/** 최소 터치 타깃(px). `tokens.css` 의 `--spacing-touch` 와 같은 값 */
export const TOUCH_TARGET_MIN = 44;

/**
 * 우측 패널 폭(px). `tokens.css` 의 `--spacing-right-panel` 과 같은 값 — **함께 고친다.**
 * 지도 엔진이 패널에 가려지는 폭을 재려고 JS 에서 이 값을 쓴다 (S15P21A405-479).
 */
export const RIGHT_PANEL_W = 376;

/**
 * 폰에서 아래에서 올라오는 판의 윗모서리(px). `tokens.css` 의 `--radius-sheet` 와 같은 값 — **함께 고친다.**
 * 재생바가 네비 줄 뒤로 이만큼 내려가 있어서(`bottom-bar.tsx`) 지도 가림폭에서 JS 로 빼야 한다 (S15P21A405-703).
 */
export const SHEET_RADIUS_PX = 30;

/**
 * 폰 바텀시트가 1·2 단에서 재생바 위로 걸리는 높이(px). `tokens.css` 의 `--spacing-sheet-s1`·`-s2` 와
 * 같은 값 — **함께 고친다.** 지도 엔진이 시트 위에 남은 지도의 가운데를 잡으려고 쓴다 (S15P21A405-703).
 * 3 단은 지도가 거의 다 덮이므로 2 단 값을 그대로 쓴다 — 올렸다 내릴 때 가운데가 출렁이지 않게.
 */
export const SHEET_SNAP_PX = { 1: 102, 2: 238, 3: 238 } as const;

/**
 * 머리글 없이 1 단으로 걸리는 시트(곡 상세·프로필)의 **본문 위 여백**(px). `tokens.css` 의
 * `--spacing-sheet-peek-top` 과 같은 값 — **함께 고친다.** 손잡이 막대(14px)를 비켜 글이 선다 (S15P21A405-703).
 */
export const SHEET_PEEK_TOP_PX = 20;

/**
 * 폰 시트 2·3 단에서 **시트 윗끝부터 본문 글이 시작하는 곳까지**(px) (S15P21A405-714). 1 단은 머리글을 접으므로 그 자리에서는
 * {@link SHEET_PEEK_TOP_PX} 다. `use-sheet-stop` 이 2 단 높이를 "본문 안 거리 + 이 값" 으로 정한다 — 머리글이 접혔든
 * 펴졌든 같은 값이 나와야 해서다.
 *
 * 여정 시트 2 단(360 × 780)에서 잰 값이다. `Box` 머리글(위 여백 14 + 한 줄 28 + 아래 여백 12 + 밑줄 1)과 본문 위 여백 14 를
 * 더하면 69 인데 잰 값은 70 이다 — 남는 1px 은 판 윗테두리로 보인다(추측). `common/box.tsx` 의 머리글·본문 여백을 바꾸면
 * **함께 고친다.** 배경을 까는 패널(곡 상세)은 밑줄이 없어 1px 작다 — 2 단이 1px 더 서는 정도라 나누지 않는다.
 */
export const SHEET_HEAD_PX = 70;
