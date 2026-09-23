import { NO_GENRE_ID } from "@/constants";
import { GENRE_COLORS, genreRgb, rgba } from "@/constants/design-tokens";
import { starColorIdx } from "./star-look";
import type { MapPoint, NearbyUser } from "@/types";
import { BudgetCache, canvasBytes } from "@/lib/budget-cache";
import { albumCover } from "./cover-art";

/** mulberry32 — 프로토타입과 같은 결정적 난수 */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPR_SIZE = 48;
let glow: HTMLCanvasElement[] | null = null;

/** 장르별 글로우 스프라이트 (48px 방사 그라데이션) */
export function glowSprites(): HTMLCanvasElement[] {
  if (glow) return glow;
  glow = GENRE_COLORS.map((rgb) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPR_SIZE;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(SPR_SIZE / 2, SPR_SIZE / 2, 0, SPR_SIZE / 2, SPR_SIZE / 2, SPR_SIZE / 2);
    const light: [number, number, number] = [Math.min(255, rgb[0] + 70), Math.min(255, rgb[1] + 70), Math.min(255, rgb[2] + 70)];
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.14, rgba(light, 0.95));
    grd.addColorStop(0.33, rgba(rgb, 0.5));
    grd.addColorStop(0.62, rgba(rgb, 0.12));
    grd.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, SPR_SIZE, SPR_SIZE);
    return c;
  });
  return glow;
}

/** 먼 배경 별 — 화면 비율 좌표에 고정 */
export interface SkyStar {
  i: number;
  u: number;
  v: number;
  m: number;
  spr: number;
  lum: number;
}
let sky: SkyStar[] | null = null;
export function skyStars(): SkyStar[] {
  if (sky) return sky;
  const rnd = mulberry32(20260902);
  sky = Array.from({ length: 1100 }, (_, i) => ({
    i,
    u: rnd(),
    v: rnd(),
    m: Math.pow(rnd(), 1.9),
    spr: Math.floor(rnd() * NO_GENRE_ID), // 배경 별은 장식이라 색 있는 장르만 (무장르 회색 제외)
    lum: Math.pow(rnd(), 0.7),
  }));
  return sky;
}

/**
 * 파고든 겹에서 상주 별 사이사이에 까는 **가까운 별먼지**. skyStars 보다 성글지만 하나하나가 크다 —
 * 비대표 상주 별과 같은 급으로 읽혀야 "별밭 속에 클릭 가능한 별이 섞여 있다"가 된다.
 * 화면 비율 좌표지만 그리는 쪽에서 카메라만큼 밀어 쓴다(월드에 붙은 것처럼 보이게).
 */
let dust: SkyStar[] | null = null;
export function dustStars(): SkyStar[] {
  if (dust) return dust;
  const rnd = mulberry32(20260912);
  dust = Array.from({ length: 2200 }, (_, i) => ({
    i,
    u: rnd(),
    v: rnd(),
    // skyStars(1.9)보다 완만해 큰 별의 비율이 높다 — 상주 별과 같은 크기대로 올라온다
    m: Math.pow(rnd(), 1.15),
    spr: Math.floor(rnd() * NO_GENRE_ID), // 장식이라 색 있는 장르만 (무장르 회색 제외)
    lum: Math.pow(rnd(), 0.6),
  }));
  return dust;
}

/* ---------- 성운 퍼프: 부드러운 방울 여러 겹, 색만 갈아 끼움 ---------- */
const PUFF_N = 208;
let puffBase: HTMLCanvasElement[] | null = null;
const puffTint = new Map<string, HTMLCanvasElement>();

function puffBases(): HTMLCanvasElement[] {
  if (puffBase) return puffBase;
  puffBase = [];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement("canvas");
    c.width = c.height = PUFF_N;
    const g = c.getContext("2d")!;
    const r = mulberry32(9001 + k * 577);
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 38; i++) {
      const a = r() * 6.284;
      const rad = Math.pow(r(), 0.65) * PUFF_N * 0.4;
      const x = PUFF_N / 2 + Math.cos(a) * rad;
      const y = PUFF_N / 2 + Math.sin(a) * rad;
      const rr = PUFF_N * (0.07 + r() * 0.27);
      const al = 0.04 + r() * 0.1;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(255,255,255,${al})`);
      gr.addColorStop(0.55, `rgba(255,255,255,${al * 0.34})`);
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, rr, 0, 6.284);
      g.fill();
    }
    g.globalCompositeOperation = "destination-in";
    const m = g.createRadialGradient(PUFF_N / 2, PUFF_N / 2, 0, PUFF_N / 2, PUFF_N / 2, PUFF_N / 2);
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(0.6, "rgba(0,0,0,.9)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = m;
    g.fillRect(0, 0, PUFF_N, PUFF_N);
    puffBase.push(c);
  }
  return puffBase;
}

/** 성운 조각. `colorIdx` 는 GENRE_COLORS 인덱스 — 별과 같은 색이어야 하므로 star-look 이 정한 값을 받는다 */
export function puffFor(k: number, colorIdx: number): HTMLCanvasElement {
  const key = `${k}:${colorIdx}`;
  let c = puffTint.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = PUFF_N;
  const g = c.getContext("2d")!;
  g.drawImage(puffBases()[k], 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = rgba(GENRE_COLORS[colorIdx], 1);
  g.fillRect(0, 0, PUFF_N, PUFF_N);
  puffTint.set(key, c);
  return c;
}

/* ---------- 절차적 프로필 사진 (곡=빛나는 점, 사람=사진 원판) ---------- */
const avCache = new Map<string, HTMLCanvasElement>();
export function avatarFor(u: NearbyUser): HTMLCanvasElement {
  let c = avCache.get(u.email);
  if (c) return c;
  if (avCache.size > 400) avCache.clear();
  const N = 76;
  c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const [a1 = 0.5, a2 = 0.5, a3 = 0.5, a4 = 0.5, a5 = 0.5, a6 = 0.5] = u.avatarSeed;
  const A = genreRgb(u.genreId);
  const B = genreRgb(u.genreId + (a1 < 0.5 ? 3 : 7));
  const gr = g.createLinearGradient(0, 0, N, N);
  gr.addColorStop(0, rgba(A, 1));
  gr.addColorStop(1, rgba(B, 1));
  g.fillStyle = gr;
  g.fillRect(0, 0, N, N);
  g.globalAlpha = 0.26;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(N * (0.16 + a5 * 0.24), N * (0.14 + a6 * 0.16), N * 0.26, 0, 6.284);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "rgba(5,9,18,.38)";
  g.beginPath();
  g.arc(N * 0.5, N * (0.4 + a2 * 0.05), N * 0.165, 0, 6.284);
  g.fill();
  g.beginPath();
  g.ellipse(N * 0.5, N * (1.06 + a3 * 0.05), N * (0.33 + a4 * 0.07), N * 0.31, 0, Math.PI, 0, true);
  g.fill();
  avCache.set(u.email, c);
  return c;
}

/** 내 헬멧용 가짜 사용자 */
export const ME_AVATAR: NearbyUser = {
  email: "me",
  nickname: "나",
  imageUrl: null,
  isOnline: true,
  musicId: 0,
  viewingMusicId: 0,
  genreId: 0,
  meetingCount: 0,
  riderCount: 0,
  followingNickname: null,
  avatarSeed: [0.32, 0.58, 0.21, 0.77, 0.44, 0.68],
};

/* ---------- 앨범 커버 ---------- */
/**
 * 지도가 쓰는 크기(px). 별 위 커버는 19~33px 로 그려지니 이만큼이면 넉넉하다 —
 * 수백 장을 들고 있는 자리라 크게 구울 이유가 없다.
 */
export const COVER_PX = 104;

/**
 * 키에 크기가 들어간다 — 같은 곡도 쓰는 자리마다 해상도가 다르다 (S15P21A405-518).
 *
 * **예산으로 잰다** (S15P21A405-586). 500장으로 세던 것을 12MB 로 바꿨다 — 104px 과 512px 이
 * 24배 차이라 장수로는 무엇을 막는지 알 수 없었고, 넘치면 `clear()` 로 통째로 비워서 지금
 * 화면에 서 있는 커버까지 다시 그려야 했다. 이제 가장 오래 안 쓴 것부터 하나씩 나간다.
 */
const coverCache = new BudgetCache<string, HTMLCanvasElement>(12 * 1024 * 1024, canvasBytes);

/**
 * 이 곡의 커버.
 *
 * **진짜 앨범 커버가 있으면 그걸 준다** (S15P21A405-518) — `albumMbid` 로 Cover Art Archive
 * 에서 받아 둔 그림이다. 아직 안 왔거나 없으면 아래 절차적 그림으로 떨어진다. 부르는 쪽은
 * 둘을 구분하지 않는다: 지도는 rAF 로 계속 다시 그리므로 도착한 다음 프레임부터 저절로 바뀐다.
 *
 * `size` 를 받는 이유는 **화질** 이다. 예전에는 104px 고정이라 곡 상세 배경(376px)에 깔면
 * 세 배 넘게 늘어나 뭉갰다. 그리는 좌표가 전부 `N` 비율이라 크게 구우면 그대로 선명해진다.
 */
export function coverFor(s: MapPoint, size: number = COVER_PX): HTMLCanvasElement {
  const real = albumCover(s.musicId, s.albumMbid, size);
  if (real) return real;
  const key = `${s.musicId}:${size}`;
  let c = coverCache.get(key);
  if (c) return c;
  const N = size;
  c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const r = mulberry32(((s.musicId + 1) * 2246822519) >>> 0);
  // 커버 색은 별 색에서 나온다 — 지도의 별과 호버 카드 커버가 어긋나면 다른 곡처럼 보인다
  const ci = starColorIdx(s);
  const A = GENRE_COLORS[ci];
  const B = GENRE_COLORS[(ci + (r() < 0.5 ? 2 : 6)) % GENRE_COLORS.length];
  const gr = g.createLinearGradient(0, 0, N * (0.3 + r()), N);
  gr.addColorStop(0, rgba(A, 1));
  gr.addColorStop(1, rgba(B, 1));
  g.fillStyle = "#070b14";
  g.fillRect(0, 0, N, N);
  g.globalAlpha = 0.82;
  g.fillStyle = gr;
  g.fillRect(0, 0, N, N);
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.2 + r() * 0.45;
    g.fillStyle = i % 2 ? "rgba(5,8,16,.95)" : "rgba(255,255,255,.92)";
    const t = Math.floor(r() * 3);
    if (t === 0) {
      g.beginPath();
      g.arc(r() * N, r() * N, N * (0.13 + r() * 0.3), 0, 6.284);
      g.fill();
    } else if (t === 1) {
      g.fillRect(0, r() * N, N, N * (0.05 + r() * 0.14));
    } else {
      const x = r() * N;
      const y = r() * N;
      const w = N * (0.28 + r() * 0.5);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + w * 0.35);
      g.lineTo(x + w * 0.25, y + w);
      g.closePath();
      g.fill();
    }
  }
  g.globalAlpha = 1;
  coverCache.set(key, c);
  return c;
}

/** 사용자 동선 잔상 (이메일 해시로 고정된 상대 좌표) */
const trailCache = new Map<string, [number, number][]>();
export function trailOf(email: string): [number, number][] {
  let t = trailCache.get(email);
  if (t) return t;
  let h = 2166136261;
  for (const ch of email) h = ((h ^ ch.charCodeAt(0)) * 16777619) >>> 0;
  const r = mulberry32(h);
  let a = r() * 6.284;
  let x = 0;
  let y = 0;
  t = [[0, 0]];
  for (let k = 0; k < 8; k++) {
    a += (r() - 0.5) * 1.0;
    x -= Math.cos(a) * (0.55 + r() * 0.6);
    y -= Math.sin(a) * (0.55 + r() * 0.6);
    t.push([x, y]);
  }
  trailCache.set(email, t);
  return t;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function fitText(g: CanvasRenderingContext2D, str: string, maxW: number) {
  if (g.measureText(str).width <= maxW) return str;
  let out = str;
  while (out.length > 2 && g.measureText(out + "…").width > maxW) out = out.slice(0, -1);
  return out + "…";
}
