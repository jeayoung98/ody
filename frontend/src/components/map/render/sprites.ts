import { NO_GENRE_ID } from "@/constants";
import { GENRE_COLORS, genreRgb, rgba, type StarShape } from "@/constants/design-tokens";
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
const glowByShape = new Map<StarShape, HTMLCanvasElement[]>();

/**
 * 장르별 글로우 스프라이트 (48px). **모양은 겹 테마가 정한다** (S15P21A405-723, `LAYER_THEMES.star`) — 기본 `halo` 는
 * 예전과 같은 방사 후광이고, 나머지 일곱은 그 위에 십자·고리·번짐 같은 특징을 얹는다. 색은 장르 그대로다.
 * 모양 × 장르로 한 번씩만 굽는다.
 */
export function glowSprites(shape: StarShape = "halo"): HTMLCanvasElement[] {
  const hit = glowByShape.get(shape);
  if (hit) return hit;
  const made = GENRE_COLORS.map((rgb) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPR_SIZE;
    const g = c.getContext("2d")!;
    const m = SPR_SIZE / 2;
    const light: [number, number, number] = [Math.min(255, rgb[0] + 70), Math.min(255, rgb[1] + 70), Math.min(255, rgb[2] + 70)];
    /** 방사 후광. `core` 가 클수록 심이 크고, `spread` 가 클수록 멀리 퍼진다 */
    const halo = (core: number, spread: number, peak = 1) => {
      const grd = g.createRadialGradient(m, m, 0, m, m, m);
      grd.addColorStop(0, `rgba(255,255,255,${peak})`);
      grd.addColorStop(0.14 * core, rgba(light, 0.95 * peak));
      grd.addColorStop(0.33 * spread, rgba(rgb, 0.5 * peak));
      grd.addColorStop(Math.min(0.98, 0.62 * spread), rgba(rgb, 0.12 * peak));
      grd.addColorStop(1, rgba(rgb, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, SPR_SIZE, SPR_SIZE);
    };
    switch (shape) {
      case "halo":
        halo(1, 1);
        break;
      case "cross": {
        halo(0.8, 0.7);
        // 네 갈래 빛줄기 — 끝으로 갈수록 옅어진다
        g.strokeStyle = rgba(light, 0.55);
        g.lineWidth = 1.6;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(m - m * 0.95, m);
        g.lineTo(m + m * 0.95, m);
        g.moveTo(m, m - m * 0.95);
        g.lineTo(m, m + m * 0.95);
        g.stroke();
        break;
      }
      case "smear":
        // 옆으로 흐르는 타원 — 은하수의 별처럼
        g.save();
        g.translate(m, m);
        g.rotate(-0.32);
        g.scale(1.55, 0.6);
        g.translate(-m, -m);
        halo(1, 1);
        g.restore();
        break;
      case "diffuse":
        // 심이 작고 멀리까지 퍼지는 뭉게별
        halo(0.6, 1.45, 0.85);
        break;
      case "point":
        // 심만 또렷하고 후광은 짧다
        halo(1.2, 0.55);
        break;
      case "ring": {
        halo(0.9, 0.7);
        g.beginPath();
        g.arc(m, m, m * 0.3, 0, 6.284);
        g.fillStyle = rgba(rgb, 1);
        g.fill();
        // 기울어진 고리
        g.save();
        g.translate(m, m);
        g.rotate(-0.4);
        g.scale(1, 0.32);
        g.beginPath();
        g.arc(0, 0, m * 0.78, 0, 6.284);
        g.restore();
        g.strokeStyle = rgba(light, 0.85);
        g.lineWidth = 2.2;
        g.stroke();
        break;
      }
      case "disc": {
        halo(0.9, 0.7, 0.7);
        g.beginPath();
        g.arc(m, m, m * 0.42, 0, 6.284);
        g.fillStyle = rgba(rgb, 1);
        g.fill();
        // 그늘진 반달 — 오른쪽 아래가 어둡다
        g.save();
        g.beginPath();
        g.arc(m, m, m * 0.42, 0, 6.284);
        g.clip();
        g.beginPath();
        g.arc(m - m * 0.16, m - m * 0.16, m * 0.42, 0, 6.284);
        g.rect(0, 0, SPR_SIZE, SPR_SIZE);
        g.fillStyle = "rgba(0,0,0,.5)";
        g.fill("evenodd");
        g.restore();
        break;
      }
      case "spark": {
        halo(1, 0.5);
        // 가늘고 긴 네 스파이크
        g.fillStyle = rgba(light, 0.85);
        const L = m * 0.98;
        const w = m * 0.13;
        g.beginPath();
        g.moveTo(m - L, m);
        g.lineTo(m, m - w);
        g.lineTo(m + L, m);
        g.lineTo(m, m + w);
        g.closePath();
        g.moveTo(m, m - L);
        g.lineTo(m + w, m);
        g.lineTo(m, m + L);
        g.lineTo(m - w, m);
        g.closePath();
        g.fill();
        break;
      }
    }
    return c;
  });
  glowByShape.set(shape, made);
  return made;
}

/** 먼 배경 별 — 화면 비율 좌표에 고정 */
/**
 * **먼 별밭 두 겹을 통째로 구워 둔 타일** (S15P21A405-499).
 *
 * 배경 별밭은 프레임당 5,170번 `drawImage` 를 부른다. 트레이스에서 `drawBackground` 가
 * `drawMap` 의 88%(11,232ms)를 먹은 원인이 여기였는데, **draw 한 번이 비싼 게 아니라 횟수가
 * 많은 것**이었다 — 스프라이트를 미리 줄여 1:1 로 찍거나(A) 알파를 단계로 뭉쳐도(B) 오히려
 * 느려졌다 (실측: 6.43 → 7.13 / 7.05ms). 줄여야 하는 것은 호출 수다.
 *
 * 그래서 시차 중간·원경 두 겹(1,100 + 770 = 1,870 draw)을 화면 한 장에 구워 두고 **감아 붙인다**
 * (4 blit × 2겹). 타일이 곧 별밭의 한 주기라 감아 붙이면 **시차는 그대로 살아 있다.**
 *
 * **잃는 것: 이 두 겹의 반짝임.** 별마다 다른 위상으로 깜빡이던 것이 평균 밝기로 굳는다.
 * 가장 먼 별밭과 가까운 별먼지는 손대지 않아 화면의 반짝임 자체는 남는다 — 이 두 겹은
 * `farFieldAlpha` 가 곱해져 원래도 어두운 쪽이라 굳은 것이 덜 보인다.
 *
 * **밝기(aK)는 굽지 않는다.** 겹 깊이에 따라 `dim` 이 계속 변하는데 그때마다 다시 구우면
 * 아무것도 아끼지 못한다. 붙일 때 `globalAlpha` 로 곱한다 — `lighter` 는 더하기라 전체에
 * 한 번 곱하는 것과 별마다 곱하는 것이 같다.
 *
 * **기기 픽셀이 아니라 CSS 픽셀로 굽는다.** dpr 2 로 구우면 1600x900 화면에서 두 장이 49MB 다
 * (실측). CSS 픽셀이면 12.2MB 이고, 대신 빨라지는 폭이 1.67배에서 1.33배로 준다 — 이 두 겹이
 * 화면에서 가장 어두운 겹이라 살짝 뭉개지는 쪽을 골랐다 (S15P21A405-586 의 캐시 예산과 같은 저울).
 */
const farTiles = new Map<string, HTMLCanvasElement>();

export interface FarFieldTile {
  canvas: HTMLCanvasElement;
  /** 타일 한 변 = 별밭 한 주기 (CSS px) */
  w: number;
  h: number;
}

export function farFieldTile(id: string, W: number, H: number, sizeK: number, stars: SkyStar[], n: number): FarFieldTile {
  const w = W + 64;
  const h = H + 64;
  const key = `${id}:${w}x${h}`;
  const hit = farTiles.get(key);
  if (hit) return { canvas: hit, w, h };
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.globalCompositeOperation = "lighter";
  for (let k = 0; k < n; k++) {
    const bg = stars[k];
    const px = (bg.u % 1) * w - 32;
    const py = (bg.v % 1) * h - 32;
    const d = bg.d0 * sizeK;
    // 반짝임(0.55~1.0)의 한가운데 값으로 굳힌다 — 평균보다 밝지도 어둡지도 않게
    g.globalAlpha = (0.06 + bg.lum * 0.19) * 0.775;
    g.drawImage(glowSprites()[bg.spr], px - d / 2, py - d / 2, d, d);
  }
  // 화면이 바뀌면 이전 크기 타일은 쓸 데가 없다. 두 겹뿐이라 통째로 비운다
  if (farTiles.size >= 2) farTiles.clear();
  farTiles.set(key, c);
  return { canvas: c, w, h };
}

export interface SkyStar {
  i: number;
  u: number;
  v: number;
  m: number;
  spr: number;
  lum: number;
  /**
   * 크기의 밑값(px). `m` 만으로 정해지므로 **프레임마다 다시 잴 이유가 없다** (S15P21A405-499).
   * 예전에는 `Math.pow(m, 1.5)` 를 별마다 매 프레임 돌렸다 — 배경 별이 5,170개라 그만큼이었다.
   * 쓰는 쪽은 여기에 그 겹의 `sizeK` 만 곱한다.
   */
  d0: number;
}
let sky: SkyStar[] | null = null;
export function skyStars(): SkyStar[] {
  if (sky) return sky;
  const rnd = mulberry32(20260902);
  sky = Array.from({ length: 1100 }, (_, i) => {
    const m = Math.pow(rnd(), 1.9);
    return {
      i,
      u: rnd(),
      v: rnd(),
      m,
      spr: Math.floor(rnd() * NO_GENRE_ID), // 배경 별은 장식이라 색 있는 장르만 (무장르 회색 제외)
      lum: Math.pow(rnd(), 0.7),
      d0: 1.3 + Math.pow(m, 1.5) * 4.2,
    };
  });
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
  dust = Array.from({ length: 2200 }, (_, i) => {
    // skyStars(1.9)보다 완만해 큰 별의 비율이 높다 — 상주 별과 같은 크기대로 올라온다
    const m = Math.pow(rnd(), 1.15);
    return {
      i,
      u: rnd(),
      v: rnd(),
      m,
      spr: Math.floor(rnd() * NO_GENRE_ID), // 장식이라 색 있는 장르만 (무장르 회색 제외)
      lum: Math.pow(rnd(), 0.6),
      d0: 1.3 + Math.pow(m, 1.5) * 4.2,
    };
  });
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
