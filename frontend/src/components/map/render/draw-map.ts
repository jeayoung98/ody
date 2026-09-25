import { CONSTELLATION, COVER_COUNT, FRIEND_MARKER, GHOST, HOLD, HOP_LINK, LAYER_COUNT, LAYER_DEPTH, LAYER_NAMES, MAP_TITLE_PX, ME_FLIGHT, ME_OFFSCREEN, PROBE, STAR_SIZE, STAR_TWINKLE, STAR_VIEW } from "@/constants";
import { FONTS, MAP_COLORS, NEBULA_WASH, rgba } from "@/constants/design-tokens";
import type { MapEngine } from "../engine/map-engine";
import { drawFriends, drawQueue, drawShip } from "./draw-friends";

/**
 * 내가 선단을 이끌 때의 우주선 크기 (S15P21A405-557).
 * 남의 우주선(12.5~15)과 같은 눈높이로 둔다 — 내 것만 크면 축척이 어긋나 보인다.
 *
 * **배율은 남의 배와 같은 것을 쓴다** (S15P21A405-642). 하나만 올리면 그 "같은 눈높이" 가
 * 그대로 깨진다 — 배가 커지는 규칙은 `FRIEND_MARKER.shipScale` 한 곳에만 둔다.
 */
const ME_SHIP_R = 13 * FRIEND_MARKER.shipScale;
/** 나는 늘 청록이다 (`--teal`). 남은 장르 색을 쓰지만 내 색은 고정이다 */
import { coverFor, dustStars, fitText, glowSprites, puffFor, roundRect, skyStars, mulberry32, type SkyStar } from "./sprites";
import { starColorIdx, starMag, starRgb } from "./star-look";
import { byCoverPriority, cellOf, gridFor, spreadOrder } from "./cover-spread";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 밝기는 크기와 느슨하게만 연동 */
function lumOf(i: number, mag: number) {
  return clamp(0.28 * mag + 0.72 * Math.pow(((i * 7919) % 1000) / 1000, 0.8), 0, 1);
}
/**
 * 큰 별 몇 개만 느리게 숨 쉰다 — 기준값과 왜 이렇게 눌렀는지는 {@link STAR_TWINKLE} 에 있다.
 * 해당 없는 별은 1 을 돌려주므로 밝기가 그대로다 — **사라지는 별은 없다.**
 */
function twinkle(id: number, t: number, mag: number) {
  if (mag < STAR_TWINKLE.minMag || id % STAR_TWINKLE.nth !== 0) return 1;
  const [dLo, dHi] = STAR_TWINKLE.depth;
  const [pLo, pHi] = STAR_TWINKLE.period;
  const dep = dLo + ((id % 11) / 10) * (dHi - dLo);
  const period = pLo + ((id % 7) / 6) * (pHi - pLo);
  return 1 - dep * (0.5 + 0.5 * Math.sin(((2 * Math.PI) / period) * t + id * 0.7));
}

/**
 * 배경. 깊은 겹일수록 **어두워지고 배경 별이 성겨진다** — 색조는 그대로라 장르색과 싸우지 않는다.
 * depth = 0(가장 얕은 겹) ~ 1(가장 깊은 겹)
 */
/**
 * 새로 도드라진 별이 밝아지는 진행도 (프로토타입 appear).
 * 한동안 안 보인 별은 잊어서, 다시 나타날 때 또 부드럽게 밝아진다.
 */
const seenAt = new Map<number, { first: number; last: number }>();
function appear(id: number, t: number) {
  const e = seenAt.get(id);
  if (!e) {
    seenAt.set(id, { first: t, last: t });
    return 0;
  }
  // 한동안 안 그려졌다면(집합에서 빠졌다가 돌아온 별) 다시 처음부터 밝아진다 — 안 그러면 예전에 본
  // 별은 기록이 남아 있어 **뚝** 하고 나온다 (S15P21A405-284)
  if ((t - e.last) * 1000 > STAR_VIEW.reappearGapMs) e.first = t;
  e.last = t;
  return Math.min(1, ((t - e.first) * 1000) / STAR_VIEW.appearMs);
}
/**
 * 기억이 너무 불면 **한동안 안 그려진** 별만 잊는다 (S15P21A405-479).
 *
 * 예전에는 `appear` 안에서 `seenAt.size > 4000 && t - e.first > 3` 이면 지웠다. 그런데 그 줄은
 * **지금 그리고 있는 별**을 지웠다 — 처음 나타나고 3초가 지나기만 하면 대상이라, 다음 프레임에
 * `appear` 가 기억을 못 찾고 0(투명)부터 다시 밝혔다. 별이 3초마다 사라졌다 나타나는 것처럼
 * 보이는 길이 여기였다. 기준을 `first`(언제 처음 봤나)에서 `last`(마지막으로 그린 때)로 바꾸면
 * 화면에 있는 별은 절대 대상이 되지 않는다.
 */
function forgetStale(t: number) {
  if (seenAt.size <= STAR_VIEW.memoryCap) return;
  for (const [id, e] of seenAt) if ((t - e.last) * 1000 > STAR_VIEW.forgetMs) seenAt.delete(id);
}

/**
 * 화면 밖이지만 살아 있는 별은 "본 것" 으로 친다 — 지도를 밀어 다시 들어올 때는 페이드하지 않는다.
 * 페이드는 **집합에 없던 별이 생길 때**만이다
 */
function touch(id: number, t: number) {
  const e = seenAt.get(id);
  if (e) e.last = t;
  else seenAt.set(id, { first: t, last: t });
}

/**
 * 지금 겹의 깊이 0~1. 전환 중에는 두 겹 사이 소수로 건너간다 —
 * 끝나는 순간 배경이 툭 바뀌면 그것부터 눈에 띈다.
 */
function depthOf(e: MapEngine) {
  const l = e.anim ? e.layer + (e.anim.layer - e.layer) * e.morphT : e.layer;
  return l / (LAYER_COUNT - 1);
}

function drawBackground(g: CanvasRenderingContext2D, e: MapEngine, depth: number) {
  const W = e.W;
  const H = e.H;
  const t = e.time;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = MAP_COLORS.background;
  g.fillRect(0, 0, W, H);
  if (depth > 0) {
    g.fillStyle = `rgba(0,0,0,${(depth * LAYER_DEPTH.maxDarken).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
  }
  const nebulaK = 1 - depth * LAYER_DEPTH.maxNebulaFade;
  g.globalCompositeOperation = "lighter";
  const big = Math.max(W, H);
  const ox = Math.sin(t * 0.015) * 44;
  const oy = Math.cos(t * 0.011) * 34;
  for (const w of NEBULA_WASH) {
    const px = w.u * W + ox;
    const py = w.v * H + oy;
    const rr = w.r * big * 0.62;
    const gr = g.createRadialGradient(px, py, 0, px, py, rr);
    gr.addColorStop(0, rgba(w.c, 0.105 * nebulaK));
    gr.addColorStop(0.42, rgba(w.c, 0.04 * nebulaK));
    gr.addColorStop(1, rgba(w.c, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fill();
  }
  const spr = glowSprites();
  const sky = skyStars();
  // 확대해서 들어온 겹이므로 별을 **덜어내지 않는다.** 밝기만 낮춰 클릭 대상인 상주 곡과 층을 가른다
  const dim = 1 - depth * LAYER_DEPTH.maxStarDim;
  const field = (ox: number, oy: number, sizeK: number, aK: number, stars: SkyStar[] = sky, n = stars.length) => {
    for (let k = 0; k < n; k++) {
      const bg = stars[k];
      const px = ((((bg.u - ox) % 1) + 1) % 1) * (W + 64) - 32;
      const py = ((((bg.v - oy) % 1) + 1) % 1) * (H + 64) - 32;
      const d = (1.3 + Math.pow(bg.m, 1.5) * 4.2) * sizeK;
      g.globalAlpha = (0.06 + bg.lum * 0.19) * (0.55 + 0.45 * Math.sin(t * (0.35 + (bg.i % 17) / 14) + bg.i)) * aK;
      g.drawImage(spr[bg.spr], px - d / 2, py - d / 2, d, d);
    }
  };
  // 가장 먼 별밭은 카메라와 무관하다 — 아무리 밀어도 제자리인 것이 오히려 "아주 멀다"로 읽힌다
  field(t * 0.0052, -t * 0.0019, 1, dim);
  /**
   * 별밭을 세 겹 더 깐다.
   * 파고들수록 상주 곡은 화면 가운데로 모이는데(fitCam 이 97%를 화면 짧은 변 44% 반지름 안에 넣는다),
   * 그 바깥이 빈 하늘이면 "확대해 들어왔다"가 아니라 "별 뭉치 하나가 떠 있다"로 읽힌다.
   * 그래서 ① 화면 전체를 별로 채우고 ② **카메라를 따라 시차를 두고 함께 밀리게** 한다 —
   * 지도를 밀 때 배경이 가만히 있으면 상주 구름만 미끄러져 뭉치의 경계가 그대로 드러난다.
   * 처음엔 0겹(우주)을 뺐지만, 0겹도 상주 구름 바깥이 빈 하늘로 보여 **모든 겹에 깐다** (S15P21A405-283).
   */
  const farK = 1;
  {
    // 월드 원점이 화면에서 밀린 양(타일 단위). 별과 같은 식으로 움직이므로 같은 세계에 있는 것처럼 보인다
    const camU = (e.cam.cx * e.cam.s) / (W + 64);
    const camV = -(e.cam.cy * e.cam.s) / (H + 64);
    const par = LAYER_DEPTH.parallax;
    const A = LAYER_DEPTH.farFieldAlpha;
    field(camU * par.mid + t * 0.0026 + 0.37, camV * par.mid - t * 0.0009 + 0.61, 0.92, dim * A * farK);
    field(camU * par.far + t * 0.0013 + 0.71, camV * par.far - t * 0.0004 + 0.23, 0.8, dim * A * 0.82 * farK, sky, Math.round(sky.length * 0.7));
    // 가장 가까운 별먼지 — 상주 별과 거의 같은 평면에서, 같은 크기대로 섞인다
    field(camU * par.near + 0.14, camV * par.near + 0.42, 1.4, dim * LAYER_DEPTH.dustAlpha * farK, dustStars());
  }
  g.globalAlpha = 1;
}

/** 성운 — 상주 곡 중 앵커(가중치 상위 일부) 주변에 가스 덩어리를 얹는다 */
const puffPlan = new Map<number, { k: number; dx: number; dy: number; sc: number; a: number }[]>();
function puffsOf(id: number) {
  let p = puffPlan.get(id);
  if (p) return p;
  const r = mulberry32(7771 + id * 31);
  p = Array.from({ length: 2 }, () => ({ k: Math.floor(r() * 4), dx: (r() - 0.5) * 0.7, dy: (r() - 0.5) * 0.7, sc: 0.55 + r() * 0.75, a: 0.1 + r() * 0.14 }));
  puffPlan.set(id, p);
  return p;
}
/** @param out true 면 전환 중 **나가는 겹**을 그린다 (posOut/alphaOut) */
function drawNebula(g: CanvasRenderingContext2D, e: MapEngine, out = false) {
  const P = out ? e.posOut : e.pos;
  const A = out ? e.alphaOut : e.alpha;
  const W = e.W;
  const H = e.H;
  // 기준 반지름. 0.55·60 이던 것을 0.75·80 으로 — 화면에서 구름이 자잘하게 흩어져 보였다 (S15P21A405-643).
  // 퍼프 수·알파는 그대로다: lighter 합성이라 그것까지 올리면 겹치는 자리가 하얗게 뜬다
  const R = clamp(0.75 * e.cam.s, 80, Math.max(W, H) * 0.8);
  g.globalCompositeOperation = "lighter";
  // 앵커: 곡 수와 무관하게 22개 정도 (결정적)
  const step = Math.max(1, Math.floor(e.N / 22));
  for (let i = 0; i < e.N; i += step) {
    // 전환 중에는 성운을 늦게 올린다 — 들어오는 겹이 작게 뭉쳐 있는 동안 켜면 가운데가 하얗게 뜬다
    const a0 = e.anim ? A[i] * A[i] * A[i] : A[i];
    if (a0 < 0.05) continue;
    const s = e.songs[i];
    const px = P[i * 2];
    const py = P[i * 2 + 1];
    if (px < -R * 1.7 || px > W + R * 1.7 || py < -R * 1.7 || py > H + R * 1.7) continue;
    for (const q of puffsOf(s.musicId)) {
      const rr = R * q.sc;
      g.globalAlpha = q.a * a0;
      g.drawImage(puffFor(q.k, starColorIdx(s)), px + q.dx * R - rr, py + q.dy * R - rr, rr * 2, rr * 2);
    }
  }
  g.globalAlpha = 1;
}

/** @param out true 면 전환 중 **나가는 겹**을 그린다 (posOut/alphaOut) */
function drawStars(g: CanvasRenderingContext2D, e: MapEngine, out = false) {
  const P = out ? e.posOut : e.pos;
  const A = out ? e.alphaOut : e.alpha;
  const spr = glowSprites();
  const W = e.W;
  const H = e.H;
  const t = e.time;
  /**
   * 파고든 겹에서는 **비대표 상주 별**(클릭 대상이 아닌 별)을 키우고 밝힌다.
   * 0겹에서는 1 이라 지금 모습 그대로다. 깊이 들어갈수록 별밭이 촘촘해져,
   * 클릭 가능한 대표 별이 빈 하늘에 홀로 뜬 게 아니라 별밭 속에 섞여 보인다.
   */
  const fieldK = Math.min(1, depthOf(e) * (LAYER_COUNT - 1));
  const fieldSize = 1 + (LAYER_DEPTH.fieldStarSize - 1) * fieldK;
  const fieldAlpha = 1 + (LAYER_DEPTH.fieldStarAlpha - 1) * fieldK;
  const grow = clamp(0.86 + Math.log(Math.max(1, e.cam.s / 100)) * 0.13, 0.86, 1.5);
  const pset = e.probeIdSet();
  const cset = e.constellationIdSet();
  const swx = Math.sin(t * 0.034) * 30 + Math.sin(t * 0.011 + 1.7) * 15;
  const swy = Math.cos(t * 0.027) * 17 + Math.sin(t * 0.008 + 0.6) * 9;
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < e.N; i++) {
    // 상주 곡은 전부 그린다 — 격자에서 이긴 별만 크고 밝다
    const a0 = A[i];
    if (a0 < 0.01) continue;
    let px = P[i * 2];
    let py = P[i * 2 + 1];
    const s = e.songs[i];
    // 긍정형으로 검사한다 — NaN 좌표는 `<`/`>` 비교가 전부 false 라 부정형이면 통과해 버리고,
    // createLinearGradient 가 non-finite 로 던진다 (S15P21A405-284)
    if (!(px >= -20 && px <= W + 20 && py >= -20 && py <= H + 20)) {
      if (!out && Number.isFinite(px)) touch(s.musicId, t);
      continue;
    }
    if (pset?.has(s.musicId) || cset?.has(s.musicId)) continue; // 프로브·별자리 곡은 따로 그린다
    const mag = starMag(s);
    // 새로 생긴 별은 어느 급이든 380ms 동안 밝아진다. 겹 전환 중 응답이 늦게 도착해 집합이 바뀌면
    // 별이 중간 알파로 **뚝** 나타났다 — 그 자리를 여기서 잡는다 (S15P21A405-284). 나가는 겹은 이미 보이던 별이다
    const born = out ? 1 : appear(s.musicId, t);
    const on = e.chosen.has(i);
    let d: number;
    let alpha: number;
    if (e.selectedId === s.musicId) {
      d = 15 + Math.pow(mag, 1.6) * 20;
      alpha = 1;
    } else if (on) {
      d = (STAR_SIZE.min + Math.pow(mag, 1.75) * (STAR_SIZE.max - STAR_SIZE.min)) * grow;
      alpha = (0.42 + lumOf(i, mag) * 0.58) * twinkle(s.musicId, t, mag) * born;
    } else {
      // 배경 별: 작고, 밝기는 별마다 다르고, 하늘처럼 함께 흐른다 (깊이만큼 시차)
      // 집을 수 없는 별이라 눌리는 별(0.42~1)과 확실히 갈라놓는다 — 임시 랜덤 크기로 배경도 커진 뒤로
      // 둘이 섞여 보여서 더 옅고 작게 눌렀다 (S15P21A405-283). 최대 알파 0.13
      d = (2.2 + Math.pow(mag, 1.6) * 3.6) * grow * fieldSize;
      alpha = (0.04 + lumOf(i, mag) * 0.09) * fieldAlpha * born;
      const drift = 0.34 + e.z[i] * 0.05;
      px += swx * drift;
      py += swy * drift;
    }
    if (!s.playable) alpha *= 0.5;
    alpha *= a0;
    if (e.hoverId === s.musicId) alpha = Math.min(1, alpha + 0.3);
    g.globalAlpha = alpha;
    g.drawImage(spr[starColorIdx(s)], px - d / 2, py - d / 2, d, d);
    // 전환 중 나가는 별은 지나간 자리에 잔상을 남긴다 — 가장자리로 훅 빠지는 게 보이게.
    // 선은 가늘고 길게, 꼬리는 투명하게 흘려 **쭉 이어지는 궤적**으로 (S15P21A405-284).
    // 빠져나갈수록(morphT) 길어진다 — 가속과 함께 늘어나야 "속도가 붙는다" 로 읽힌다
    if (out && e.anim && e.anim.mode === "dive" && alpha > 0.03) {
      const f2 = e.freeRect();
      const tx = px - f2.cx;
      const ty = py - f2.cy;
      const td = Math.hypot(tx, ty) || 1;
      const len = Math.min(260, td * (0.18 + 0.6 * e.morphT)) * (e.anim.dir > 0 ? 1 : -1);
      const x0 = px - (tx / td) * len;
      const y0 = py - (ty / td) * len;
      const tail = g.createLinearGradient(x0, y0, px, py);
      const rgb = starRgb(s);
      tail.addColorStop(0, rgba(rgb, 0));
      tail.addColorStop(1, rgba(rgb, 0.85));
      g.globalAlpha = Math.min(1, alpha * 0.9);
      g.strokeStyle = tail;
      g.lineWidth = Math.max(0.5, d * 0.07);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(px, py);
      g.stroke();
    }
    if (on) {
      g.globalAlpha = 0.95 * alpha;
      g.fillStyle = MAP_COLORS.core;
      g.beginPath();
      g.arc(px, py, 0.95 + Math.pow(mag, 1.75) * 2.3, 0, 6.284);
      g.fill();
      if (mag > 0.88) {
        g.strokeStyle = rgba(starRgb(s), 0.22 * alpha);
        g.lineWidth = 1;
        const len = d * 0.7;
        g.beginPath();
        g.moveTo(px - len, py);
        g.lineTo(px + len, py);
        g.moveTo(px, py - len);
        g.lineTo(px, py + len);
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

/**
 * 지금 커버를 띄우고 있는 곡의 **인덱스** (그린 순서 유지).
 *
 * 인덱스는 곡이 뒤에 이어붙어도 그대로라 프레임을 건너 들고 있어도 안전하다.
 * 겹이 바뀌면 기준 축이 달라지므로 비운다.
 */
let coverIdx: number[] = [];
let coverLayer = -1;
/** 지난 프레임의 카메라. 미는 중인지 확대하는 중인지를 여기서 가른다 (S15P21A405-529) */
let coverCam = { cx: Number.NaN, cy: Number.NaN, s: Number.NaN };

/**
 * 대표성이 가장 높은 몇 곡은 앨범 커버로 띄운다.
 *
 * **매 프레임 새로 뽑으면 줌할 때 통째로 갈린다.** 격자 칸이 배율에 반비례해서(`gw = 86 / cam.s`)
 * 확대하면 칸 승자가 전부 바뀌고, 거기서 앞 N개를 잘라 쓰니 커버가 싹 교체된다
 * (실측: 배율 21.8→34.2 에서 7개 전부 교체 — S15P21A405-276).
 * `weight` 가 실데이터에서 전부 0 이라 정렬이 무의미한 것도 증폭시킨다 (B-21).
 *
 * 그래서 **있던 커버를 먼저 지키고**, 화면 밖으로 나갔거나 상주가 아니게 된 자리만 새로 채운다.
 */
function drawCovers(g: CanvasRenderingContext2D, e: MapEngine) {
  // 그린 것만 집힌다 (S15P21A405-452). 안 그리고 나가는 길에도 비워야 지난 프레임 자리가 안 남는다
  e.coverHits = [];
  if (e.anim) return;
  const f = e.freeRect();
  /** 새로 올릴 때 가장자리에서 띄워 둘 거리(px) */
  const M = 42;
  /** 이미 그린 커버를 놓아 주는 선 — 그림이 통째로 화면 밖으로 나가면 (S15P21A405-529) */
  const KEEP = COVER_COUNT.sizePx;
  const grow = clamp(0.86 + Math.log(Math.max(1, e.cam.s / 100)) * 0.13, 0.85, 1.35);
  if (e.coverAlpha < 0.01) return;

  // 겹이 바뀌면 축이 달라져 자리도 의미가 없다 — 처음부터 다시 뽑는다
  if (coverLayer !== e.layer) {
    coverIdx = [];
    coverLayer = e.layer;
    // 겹이 바뀐 것은 미는 것이 아니다 — 곧바로 채우게 카메라 기억도 비운다 (S15P21A405-529)
    coverCam = { cx: Number.NaN, cy: Number.NaN, s: Number.NaN };
  }

  const n = e.cam.s < COVER_COUNT.nearScale ? COVER_COUNT.far : COVER_COUNT.near;
  const gap2 = COVER_COUNT.minGapPx * COVER_COUNT.minGapPx;

  /**
   * **미는 동안에는 새 커버를 올리지 않는다** (S15P21A405-529).
   *
   * 예전에는 밀면서 가장자리 커버가 내려가고 그 자리를 다른 곡이 채우기를 반복했다 — 화면이
   * 계속 깜빡였다. 미는 것은 "지금 있는 것을 계속 보겠다" 는 뜻이지 새 그림을 달라는 게 아니다.
   *
   * **배율이 바뀌면 예외다.** 줌은 보이는 범위 자체가 달라지는 일이라 새로 뽑는 것이 맞고,
   * 사용자도 그때는 바뀌기를 기대한다. 줌은 커서 기준이라 cx·cy 도 같이 움직이므로 배율을 먼저 본다.
   */
  const zooming = e.cam.s !== coverCam.s;
  const panning = !zooming && (e.cam.cx !== coverCam.cx || e.cam.cy !== coverCam.cy);
  coverCam = { cx: e.cam.cx, cy: e.cam.cy, s: e.cam.s };
  /**
   * 아직 이 겹에 살아 있고 화면 안인가.
   *
   * **지킬 때와 올릴 때 기준이 다르다** (히스테리시스, S15P21A405-529). 예전에는 둘 다 여백
   * 42px 이라, 화면 안에 멀쩡히 보이는 커버가 가장자리에 닿는 순간 내려갔다가 조금만 되밀면
   * 다시 올라왔다. 올릴 때는 안쪽에 편히 들어와야 하고(`M`), **이미 그린 것은 화면 밖으로
   * 완전히 나갈 때까지 남긴다**(`-KEEP`).
   */
  const usable = (i: number, forNew = false) => {
    if (!e.subset[i]) return false;
    const m = forNew ? M : -KEEP;
    const px = e.pos[i * 2];
    const py = e.pos[i * 2 + 1];
    return px > f.x0 + m && px < f.x1 - m && py > f.y0 + m && py < f.y1 - m;
  };
  /** 이미 고른 것들과 충분히 떨어져 있는가 (줌아웃하면 별이 모여 커버가 겹친다) */
  const spaced = (i: number, picked: number[]) =>
    picked.every((j) => (e.pos[i * 2] - e.pos[j * 2]) ** 2 + (e.pos[i * 2 + 1] - e.pos[j * 2 + 1]) ** 2 >= gap2);

  // ① 있던 커버를 먼저 지킨다 — 이게 반짝임을 막는 핵심이다
  const picked: number[] = [];
  for (const i of coverIdx) {
    if (picked.length >= n) break;
    if (usable(i) && spaced(i, picked)) picked.push(i);
  }
  /*
   * ② 남는 자리를 **화면 전체에 고루** 채운다 (S15P21A405-518).
   *
   * 예전에는 후보를 배열 순서대로 훑어 앞에서부터 집었다. `weight` 정렬이 붙어 있었지만
   * 실데이터는 전부 0 이라 정렬이 아무것도 안 하고, 결국 **상주 집합이 담겨 온 순서**가 곧
   * 우선순위였다 — 그 순서가 좌표와 상관있어서 커버가 화면 왼쪽에만 우르르 몰렸다.
   * 최소 간격(`spaced`)은 54px 겹침만 막을 뿐 "고루 퍼짐" 을 만들지는 못한다.
   *
   * 그래서 **화면을 커버 수만큼 칸으로 나누고 칸마다 하나씩** 집는다. 이미 커버가 있는 칸은
   * 건너뛰므로 새 커버는 늘 비어 있는 쪽으로 간다.
   */
  if (picked.length < n && !panning) {
    const candidates = new Set<number>();
    for (let i = 0; i < e.N; i++) if (e.subset[i] && e.repIds.has(e.songs[i].musicId)) candidates.add(i);
    /**
     * 격자 대표곡을 **늘 함께 넣는다.** 예전에는 후보가 모자랄 때만 더했는데, 대표곡 40곡이
     * 한쪽에 뭉쳐 있으면 개수는 충분하면서 자리는 비는 일이 생긴다. `chosen` 은 86px 월드
     * 격자에서 칸마다 하나씩 뽑은 것이라 화면에 고르게 흩어져 있다.
     */
    for (const i of e.chosen) candidates.add(i);

    // 칸마다 하나씩 (규칙과 검사는 `cover-spread.ts`)
    const at = (i: number) => ({ x: e.pos[i * 2], y: e.pos[i * 2 + 1] });
    const { cols, rows } = gridFor(n, f);
    const taken = new Set(picked.map((i) => cellOf(at(i).x, at(i).y, f, cols, rows)));
    /*
     * 같은 칸에 여럿이면 `spreadOrder` 가 **먼저 온 것**을 남긴다. 그래서 넣기 전에 줄을
     * 세워 둔다 — 앨범 ID 있음 > 재생수 > 받은 순서 (S15P21A405-528).
     */
    const fill = spreadOrder(
      [...candidates]
        .filter((i) => !picked.includes(i) && usable(i, true))
        .sort(byCoverPriority((i) => e.songs[i].albumMbid != null, (i) => e.songs[i].weight)),
      at,
      f,
      n,
      taken,
    );
    // 처음(들고 있던 게 없다)에는 한 번에 채운다. 그 뒤로는 한 칸씩만 — 위 주석 참고
    let room = coverIdx.length === 0 ? n : COVER_COUNT.fillPerFrame;
    for (const i of fill) {
      if (picked.length >= n || room <= 0) break;
      if (spaced(i, picked)) {
        picked.push(i);
        room--;
      }
    }
  }
  coverIdx = picked;

  g.globalCompositeOperation = "source-over";
  g.globalAlpha = e.coverAlpha;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `500 ${MAP_TITLE_PX.cover}px ${FONTS.body}`;
  /**
   * **먼 것부터, 가까운 것을 맨 위에** (S15P21A405-632). 크기는 깊이를 따르는데(614) 그리는
   * 순서는 `picked`(우선순위) 순이라, 뒤쪽의 작은 커버가 앞쪽의 큰 커버를 덮어 원근이 뒤집혀
   * 보였다. 화가 알고리즘대로 깊이 배율 오름차순으로 그린다 — `picked` 자체는 안 건드린다,
   * 그 순서는 다음 프레임의 자리 유지에 쓰인다.
   */
  const paintOrder = [...picked].sort((a, b) => e.depthScale(a) - e.depthScale(b));
  for (const i of paintOrder) {
    const it = { px: e.pos[i * 2], py: e.pos[i * 2 + 1], s: e.songs[i] };
    // 글자 밝기는 곡마다 같다 (S15P21A405-518). 크기는 배율 확대에 **서 있는 별의 깊이**만 곱한다 —
    // 가까운 별 위 커버는 크고 빨리, 먼 별 위는 작고 천천히 지나가 별과 한 몸으로 읽힌다 (S15P21A405-614)
    const S = COVER_COUNT.sizePx * grow * e.depthScale(i);
    // 그림이 별(r=15)보다 크다 — 클릭도 커버 크기로 받는다 (S15P21A405-452).
    // 호버·선택 곡은 커버 대신 큰 별로 그리지만 상자는 남긴다 — 빼면 호버가 켜지는 순간
    // 집을 자리가 사라져 깜빡인다
    e.coverHits.push({ i, px: it.px, py: it.py, r: S / 2 });
    if (e.hoverId === it.s.musicId || e.selectedId === it.s.musicId) continue;
    const x = it.px - S / 2;
    const y = it.py - S / 2;
    g.save();
    g.beginPath();
    g.roundRect(x, y, S, S, 6);
    g.clip();
    g.drawImage(coverFor(it.s), x, y, S, S);
    g.restore();
    g.beginPath();
    g.roundRect(x, y, S, S, 6);
    g.strokeStyle = "rgba(255,255,255,.24)";
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = "rgba(233,241,255,.58)";
    g.fillText(fitText(g, it.s.title, 104), it.px, it.py + S / 2 + 10);
  }
  g.globalAlpha = 1;
}
/**
 * 별자리 오버레이 뷰 (PATH-01) — 임시 뷰다. 화면을 어둡게 덮고 곡들을 고정 배치로 모아 선으로 잇는다.
 * 위치는 엔진 constellationPos (실제 위치 → 배치 위치로 보간)라 켜고 끌 때 날아가 모이고 흩어진다.
 * 배치는 백엔드가 16차원을 2D로 압축해 준 값이라 **레이어가 달라도 모양이 같다.**
 *
 * 재생 진행을 투명도로 보인다: 지금 듣는 곡만 또렷하고, 이미 지나온 곡은 옅게,
 * 아직 안 들은 곡은 더 옅게. 지금 듣는 곡 위에는 내 위치 다이아몬드가 놓인다.
 */
function drawConstellation(g: CanvasRenderingContext2D, e: MapEngine, currentMusicId: number | null) {
  const c = e.constellation;
  if (!c) return;
  const k = e.constellationK();
  if (k < 0.01) return;
  const spr = glowSprites();
  const pts: { id: number; x: number; y: number }[] = [];
  for (const id of c.ids) {
    const p = e.constellationPos(id);
    if (p) pts.push({ id, x: p.x, y: p.y });
  }
  if (pts.length < 2) return;

  // 현재 곡까지가 "들은 곡". 재생 중이 아니면(-1) 전부 아직 안 들은 곡이다
  const cursor = currentMusicId == null ? -1 : c.ids.indexOf(currentMusicId);
  const progressOf = (i: number) => (cursor < 0 || i > cursor ? "unplayed" : i === cursor ? "current" : "played");
  const alphaOf = (i: number) => CONSTELLATION.alpha[progressOf(i)];

  // 배경 어둡게
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(4,6,13,${(CONSTELLATION.dim * k).toFixed(3)})`;
  g.fillRect(0, 0, e.W, e.H);

  // 경로선 — 지나온 구간은 또렷하고, 앞으로 갈 구간은 옅다
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 2.4;
  g.lineJoin = "round";
  g.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    const passed = cursor >= 0 && i <= cursor;
    g.globalAlpha = k * (passed ? 0.85 : 0.28);
    g.strokeStyle = MAP_COLORS.routeStops[passed ? 0 : 1];
    g.beginPath();
    g.moveTo(pts[i - 1].x, pts[i - 1].y);
    g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }

  // 곡 별 (글로우) + 정거장 원
  pts.forEach((p, i) => {
    const s = e.songs[e.songs.findIndex((x) => x.musicId === p.id)];
    const a = alphaOf(i);
    const cur = progressOf(i) === "current";
    const d = cur ? 34 : 24;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = k * a * (s.playable ? 1 : 0.55);
    g.drawImage(spr[starColorIdx(s)], p.x - d / 2, p.y - d / 2, d, d);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = k * a;
    g.beginPath();
    g.arc(p.x, p.y, cur ? 6.5 : 4.6, 0, 6.284);
    g.fillStyle = MAP_COLORS.stationFill;
    g.fill();
    g.lineWidth = cur ? 2.6 : 1.8;
    g.strokeStyle = cur ? MAP_COLORS.stationCurrent : MAP_COLORS.stationStroke;
    g.stroke();
    if (e.hoverId === p.id || e.selectedId === p.id) {
      g.globalAlpha = k;
      g.strokeStyle = rgba(starRgb(s), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(p.x, p.y, 13, 0, 6.284);
      g.stroke();
    }
  });

  /**
   * 라벨: 제목만 (순번 없음). 진행도로 옅어지되 바닥을 둬서 아직 안 들은 곡도 읽힌다.
   *
   * **겹치면 비켜 주고, 비킬 자리가 없으면 그리지 않는다** (S15P21A405-330). 예전에는 무조건
   * 별 아래 고정 자리에 그려서, 곡이 붙어 있는 구간은 제목이 서로 겹쳐 하나도 못 읽었다.
   *
   * 우선순위가 높은 것부터 자리를 잡는다 — 지금 듣는 곡 · 선택 · 호버는 **반드시** 읽혀야 하고,
   * 그 셋은 제목도 안 자른다 (긴 제목은 누르거나 가리켜서 읽는다). 숨겨진 곡은 호버 툴팁이 맡는다.
   */
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `600 12px ${FONTS.body}`;
  const H = 17;
  const gap = CONSTELLATION.labelGapPx;
  // 별 자리를 먼저 채워 둔다 — 남의 제목이 별을 덮으면 그 별이 안 보인다
  const taken = pts.map((p) => ({ x0: p.x - 9, y0: p.y - 9, x1: p.x + 9, y1: p.y + 9 }));
  const hits = (b: { x0: number; y0: number; x1: number; y1: number }) =>
    taken.some((t) => b.x0 < t.x1 + gap && b.x1 > t.x0 - gap && b.y0 < t.y1 + gap && b.y1 > t.y0 - gap);
  // 앞자리일수록 먼저 자리를 잡는다. 같은 등급이면 여정 순서대로
  const rank = (i: number) => (i === cursor ? 0 : pts[i].id === e.selectedId ? 1 : pts[i].id === e.hoverId ? 2 : 3);
  const order = pts.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
  for (const i of order) {
    const p = pts[i];
    const s = e.songs[e.songs.findIndex((x) => x.musicId === p.id)];
    const must = rank(i) < 3;
    const title = fitText(g, s.title, must ? 260 : 120);
    const w = g.measureText(title).width + 12;
    // 아래 → 위 → 오른쪽 → 왼쪽. 아래가 기본이라 대부분은 예전과 같은 자리에 그대로 앉는다
    const spots = [
      { x0: p.x - w / 2, y0: p.y + 14 },
      { x0: p.x - w / 2, y0: p.y - 14 - H },
      { x0: p.x + 14, y0: p.y - H / 2 },
      { x0: p.x - 14 - w, y0: p.y - H / 2 },
    ].map((q) => ({ ...q, x1: q.x0 + w, y1: q.y0 + H }));
    // 읽혀야 하는 라벨은 자리가 없어도 기본 자리에 그린다 — 안 보이는 것보다 겹치는 게 낫다
    const box = spots.find((q) => !hits(q)) ?? (must ? spots[0] : null);
    if (!box) continue;
    taken.push(box);
    g.globalAlpha = k * Math.max(CONSTELLATION.labelMinAlpha, alphaOf(i));
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, box.x0, box.y0, w, H, 5);
    g.fill();
    g.fillStyle = "#dbe4f2";
    g.fillText(title, box.x0 + w / 2, box.y0 + H / 2);
  }

  // 지금 듣는 곡 위에 내 위치 다이아몬드
  if (cursor >= 0) {
    g.globalAlpha = k;
    drawMeMarker(g, pts[cursor].x, pts[cursor].y, e.time);
  }
  g.globalAlpha = 1;
}

/** 주변 탐색: 기준 곡 주변만 남기고 어둡게 덮고, 유사곡으로 뻗는 별자리선 */
/**
 * 주변 탐색(프로브) — 연출용 뷰.
 * 화면 전체를 어둡게 덮고, 기준 곡을 중앙에, 유사곡 10곡을 두 겹 고리로 배치해 선으로 잇는다.
 * 위치는 실제 좌표가 아니라 엔진의 probePos (실제 위치 → 배치 위치로 보간).
 */
function drawProbe(g: CanvasRenderingContext2D, e: MapEngine) {
  const p = e.probe;
  if (!p) return;
  const k = e.probeK();
  if (k < 0.01) return;
  const spr = glowSprites();
  const cur = e.currentRing() ?? p.rings[p.rings.length - 1];
  const center = e.probePos(cur.centerId);
  if (!center) return;
  const tx = center.x;
  const ty = center.y;

  // 전체를 어둡게 덮는다 (진행도에 따라) — 지금 중심을 기준으로
  g.globalCompositeOperation = "source-over";
  const f = e.freeRect();
  const Rv = Math.min(f.x1 - f.x0, f.y1 - f.y0) * 0.5;
  const vg = g.createRadialGradient(tx, ty, Rv * 0.2, tx, ty, Rv * 1.9);
  vg.addColorStop(0, `rgba(4,6,13,${0.55 * k})`);
  vg.addColorStop(0.55, `rgba(4,6,13,${0.78 * k})`);
  vg.addColorStop(1, `rgba(4,6,13,${0.92 * k})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, e.W, e.H);

  /**
   * 고리마다 그린다 (S15P21A405-285). 같은 곡이 두 고리에 있으면 **가장 새 고리**에서 한 번만 —
   * probePos 도 그 고리를 따르므로 선과 별이 어긋나지 않는다. 지금 고리가 아닌 것은 옅게(prevAlpha) 깔린다
   */
  type Node = { id: number; x: number; y: number; rank: number; a: number; cur: boolean; sc: number };
  const placed = new Set<number>();
  const nodes: Node[] = [];
  const centers: { id: number; x: number; y: number; a: number; cur: boolean; sc: number }[] = [];
  for (let ri = p.rings.length - 1; ri >= 0; ri--) {
    const r = p.rings[ri];
    const isCur = r === cur;
    /**
     * **벌려 본 배율이 크기에도 걸린다** (S15P21A405-593). 자리만 벌리면 별은 그대로인 채
     * 이웃이 멀어질 뿐이라 "확대" 로 안 읽힌다 — 간격과 크기가 같이 커져야 다가간 것이 된다.
     * 이 값은 별 지름과 가운데 점, 강조 링에 함께 쓰인다.
     */
    const sc = e.ringScale(r);
    // 물러난 고리는 오므라드는 만큼 옅어진다 — 뭉치가 될 때 밝기가 그대로면 새 고리보다 눈에 띈다
    const a = k * e.ringK(r) * (isCur ? 1 : PROBE.prevAlpha);
    if (a < 0.01) continue;
    const c = e.probePos(r.centerId);
    if (!c) continue;
    if (!placed.has(r.centerId)) {
      placed.add(r.centerId);
      centers.push({ id: r.centerId, x: c.x, y: c.y, a, cur: isCur, sc });
    }
    // 이전 중심 → 이 중심: 어디서 건너왔는지 잇는 선
    if (ri > 0) {
      const prev = e.probePos(p.rings[ri - 1].centerId);
      if (prev) {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = `rgba(150,180,240,${0.22 * k * e.ringK(p.rings[ri - 1])})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(prev.x, prev.y);
        g.lineTo(c.x, c.y);
        g.stroke();
        g.restore();
      }
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    g.setLineDash([3, 5]);
    g.lineDashOffset = -((e.time * 16) % 8);
    g.lineWidth = 1;
    r.ids.forEach((id, rank) => {
      // 상주 여부는 묻지 않는다 — 이웃은 지도 집합 밖 곡이다. 자리를 못 잡은 곡만 건너뛴다
      const pp = e.probePos(id);
      if (!pp) return;
      if (!placed.has(id)) {
        placed.add(id);
        nodes.push({ id, x: pp.x, y: pp.y, rank, a, cur: isCur, sc });
      }
      g.strokeStyle = `rgba(150,180,240,${0.3 * a})`;
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.lineTo(pp.x, pp.y);
      g.stroke();
    });
    g.setLineDash([]);
    g.restore();
  }

  // 유사곡 별 (밝게) + 순위·제목
  g.globalCompositeOperation = "lighter";
  for (const n of nodes) {
    const s = e.songs.find((x) => x.musicId === n.id)!;
    const d = (22 + (1 - n.rank / 10) * 10) * n.sc;
    g.globalAlpha = 0.95 * n.a * (s.playable ? 1 : 0.55);
    g.drawImage(spr[starColorIdx(s)], n.x - d / 2, n.y - d / 2, d, d);
    g.globalAlpha = n.a;
    g.fillStyle = MAP_COLORS.core;
    g.beginPath();
    g.arc(n.x, n.y, 2.4 * n.sc, 0, 6.284);
    g.fill();
    if (e.hoverId === n.id || e.selectedId === n.id) {
      g.strokeStyle = rgba(starRgb(s), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(n.x, n.y, 12, 0, 6.284);
      g.stroke();
    }
  }
  g.globalCompositeOperation = "source-over";
  g.textAlign = "center";
  g.textBaseline = "middle";
  /**
   * 별 밑 라벨 — 제목, (있으면) 부제, 선택한 곡이면 **"주변 보기 ›" 링크** (S15P21A405-288).
   * 이웃을 누르는 것만으로는 건너가지 않으므로(선택·재생만), 건너가는 길이 시선이 있는 자리에 글씨로 보여야 한다.
   * 떠다니는 버튼을 얹는 대신 이미 있는 라벨 묶음 안에 넣는다. 히트 영역은 엔진에 적어 두고 클릭은 map-view 가 받는다
   */
  const drawLabel = (x: number, y: number, s: (typeof e.songs)[number], sub: string | null, a: number, link: boolean) => {
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = a;
    g.font = `500 ${MAP_TITLE_PX.label}px ${FONTS.body}`;
    const title = fitText(g, s.title, 126);
    const tw = g.measureText(title).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, x - tw / 2 - 6, y + 13, tw + 12, 19, 5);
    g.fill();
    g.fillStyle = "rgba(233,241,255,.92)";
    g.fillText(title, x, y + 22.5);
    if (sub) {
      // 10px 이었다 (S15P21A405-649). 제목만 커지고 이 줄은 그대로라 `#3 · 가수` 가 안 읽혔다.
      // 베이스라인도 같이 내린다 — 글자가 커지면 제목 상자(y+13 부터 19) 에 머리가 닿는다
      g.font = `500 12px ${FONTS.mono}`;
      g.fillStyle = "rgba(147,164,196,.7)";
      g.fillText(sub, x, y + 36);
    }
    if (link) {
      const pulse = 0.72 + 0.28 * Math.sin(e.time * 3);
      g.globalAlpha = a * pulse;
      g.font = `600 11.5px ${FONTS.body}`;
      g.fillStyle = MAP_COLORS.me;
      const label = "주변 보기 ›";
      const lw = g.measureText(label).width;
      g.fillText(label, x, y + HOP_LINK.dy);
      e.hopLink = { id: s.musicId, x: x - lw / 2 - HOP_LINK.padX, y: y + HOP_LINK.dy - HOP_LINK.h / 2, w: lw + HOP_LINK.padX * 2, h: HOP_LINK.h };
    }
  };
  // 라벨은 지금 고리에만 — 옅은 고리까지 글자를 달면 읽히지 않고 어지럽기만 하다.
  // **선택한 곡의 라벨은 맨 나중에** 그린다 (아래) — 겹친 라벨 밑에 깔려 안 읽히면 무엇을 눌렀는지 모른다
  for (const n of nodes) {
    if (!n.cur || n.id === e.selectedId) continue;
    const s = e.songs.find((x) => x.musicId === n.id)!;
    drawLabel(n.x, n.y, s, `#${n.rank + 1} · ${s.artist ?? ""}`, n.a, false);
  }
  g.globalAlpha = 1;

  // 이전 중심 — 옅게. 이전 고리에서 누를 수 있는 건 중심 하나라, 호버·선택되면 링으로 답한다
  g.globalCompositeOperation = "lighter";
  for (const c of centers) {
    if (c.cur) continue;
    const s = e.songs.find((x) => x.musicId === c.id)!;
    g.globalAlpha = c.a;
    const cd = 32 * c.sc;
    g.drawImage(spr[starColorIdx(s)], c.x - cd / 2, c.y - cd / 2, cd, cd);
    g.fillStyle = MAP_COLORS.core;
    g.beginPath();
    g.arc(c.x, c.y, 2.4, 0, 6.284);
    g.fill();
    if (e.hoverId === c.id || e.selectedId === c.id) {
      g.globalAlpha = Math.min(1, k);
      g.strokeStyle = rgba(starRgb(s), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(c.x, c.y, 12, 0, 6.284);
      g.stroke();
    }
    // 제목은 늘 옅게 붙여 둔다 — 어디서 건너왔는지 이름으로 읽히고, 누를 수 있는 자리라는 힌트가 된다.
    // 선택되면 아래에서 또렷한 라벨을 위에 덧그린다
    if (e.selectedId !== c.id) drawLabel(c.x, c.y, s, "이전 중심", c.a * 1.6, false);
    g.globalCompositeOperation = "lighter";
  }

  // 기준 곡 강조 + 라벨
  const song = e.songs.find((s) => s.musicId === cur.centerId)!;
  const frgb = starRgb(song);
  // 건너온 중심은 열리면서 한 번 부풀었다 가라앉는다 (누른 별이 열리는 느낌)
  const rk = e.ringK(cur);
  const pop = cur.unfold ? 1 + 0.55 * Math.sin(Math.PI * rk) : 1;
  const rr = (19 + Math.sin(e.time * 2.2) * 2.4) * pop;
  const ck = k * rk;
  g.globalAlpha = ck;
  const cd = 44 * pop;
  g.drawImage(spr[starColorIdx(song)], tx - cd / 2, ty - cd / 2, cd, cd);
  g.beginPath();
  g.arc(tx, ty, rr, 0, 6.284);
  g.strokeStyle = rgba(frgb, 0.85);
  g.lineWidth = 1.6;
  g.stroke();
  g.beginPath();
  g.arc(tx, ty, rr * 0.56, 0, 6.284);
  g.strokeStyle = rgba(frgb, 0.34);
  g.lineWidth = 1;
  g.stroke();
  g.globalCompositeOperation = "source-over";
  g.font = `600 13.5px ${FONTS.body}`;
  const tw = g.measureText(song.title).width;
  g.fillStyle = MAP_COLORS.labelBg;
  roundRect(g, tx - tw / 2 - 7, ty + rr + 6, tw + 14, 19, 6);
  g.fill();
  g.fillStyle = "rgba(233,241,255,.98)";
  g.fillText(song.title, tx, ty + rr + 15.5);
  g.font = `500 11px ${FONTS.mono}`;
  g.fillStyle = "rgba(147,164,196,.62)";
  g.fillText(`NEARBY · 유사도 상위 ${cur.ids.length}곡 · ${LAYER_NAMES[e.layer]}`, tx, ty + rr + 30);

  // 선택한 곡의 라벨 — 모든 라벨 위에. 지금 고리의 이웃이거나 이전 고리의 중심이다
  const sel = e.selectedId;
  if (sel != null && sel !== cur.centerId) {
    const n = nodes.find((x) => x.id === sel && x.cur);
    const c = n ? null : centers.find((x) => x.id === sel && !x.cur);
    const s = e.songs.find((x) => x.musicId === sel);
    if (n && s) drawLabel(n.x, n.y, s, `#${n.rank + 1} · ${s.artist ?? ""}`, n.a, true);
    else if (c && s) drawLabel(c.x, c.y, s, "이전 중심", Math.min(1, k), true);
  }
  g.globalAlpha = 1;
}

/**
 * 내 위치 표식 — 맥동하는 두 겹 링 + 다이아몬드.
 * 지도의 "나"와 별자리 뷰의 "지금 듣는 곡" 둘 다 이걸 쓴다 (PATH-01).
 */
/** 표식 반지름 — 화살촉을 그 바깥에 붙여야 해서 밖에서도 쓴다 */
function meRadius(t: number) {
  return 13 + Math.sin(t * 1.6) * 2.6;
}

/** 내 표식 색 세트. 듣는 곡이 이 겹 밖이면 보라로 바꿔 "여기가 아니다"를 색으로 말한다 */
function meTheme(away: boolean) {
  return away
    ? { core: MAP_COLORS.meAway, ring: MAP_COLORS.meAwayRing, inner: MAP_COLORS.meAwayRingInner }
    : { core: MAP_COLORS.me, ring: MAP_COLORS.meRing, inner: MAP_COLORS.meRingInner };
}

function drawMeMarker(g: CanvasRenderingContext2D, px: number, py: number, t: number, away = false) {
  const rr = meRadius(t);
  const c = meTheme(away);
  g.save();
  g.translate(px, py);
  g.globalCompositeOperation = "lighter";
  g.beginPath();
  g.arc(0, 0, rr, 0, 6.284);
  g.strokeStyle = c.ring;
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, rr * 0.62, 0, 6.284);
  g.strokeStyle = c.inner;
  g.stroke();
  g.rotate(Math.PI / 4);
  g.fillStyle = c.core;
  g.fillRect(-4, -4, 8, 8);
  g.restore();
}

/**
 * 화면 밖으로 나간 '나' (MAP-08).
 *
 * **화면 안 표식과 모양이 달라야 한다.** 같은 마름모+링을 가장자리에 그리면
 * "지금 보는 화면 위에 내가 떠 있다"로 읽힌다. 여기서는 링을 빼고 **작은 점 + 바깥을 가리키는
 * 화살촉**만 그리고 투명도도 낮춘다 — "여기 있다"가 아니라 "저쪽에 있다"로 읽히게.
 */
function drawMeAway(g: CanvasRenderingContext2D, e: MapEngine, off: { x: number; y: number; dir: { x: number; y: number }; elsewhere: boolean }) {
  const { x, y, dir, elsewhere } = off;
  const c = meTheme(elsewhere);
  const a = ME_OFFSCREEN.arrow;
  // 숨을 쉬듯 아주 옅게만 흔든다 (화면 안 표식처럼 크게 뛰지 않는다)
  const pulse = 0.88 + 0.12 * Math.sin(e.time * 1.6);
  g.save();
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = ME_OFFSCREEN.awayAlpha * pulse;

  // 점 — 링 없이 작게
  g.fillStyle = c.core;
  g.beginPath();
  g.arc(x, y, ME_OFFSCREEN.awayDot, 0, 6.284);
  g.fill();

  // 바깥을 가리키는 화살촉
  const ax = x + dir.x * (ME_OFFSCREEN.awayDot + a.gap);
  const ay = y + dir.y * (ME_OFFSCREEN.awayDot + a.gap);
  g.beginPath();
  g.moveTo(ax + dir.x * a.len, ay + dir.y * a.len);
  g.lineTo(ax - dir.y * a.half, ay + dir.x * a.half);
  g.lineTo(ax + dir.y * a.half, ay - dir.x * a.half);
  g.closePath();
  g.fill();

  // 라벨 — 화살촉 반대쪽에 붙여 겹치지 않게
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `600 11px ${FONTS.mono}`;
  g.fillStyle = c.core;
  g.fillText("나", x - dir.x * 13, y - dir.y * 13);
  g.restore();
  g.globalAlpha = 1;
}

/**
 * 내 좌표 (MAP-08). 탑승 중에는 선미의 '나' 헬멧이, 별자리 뷰에서는 대형 안 현재 곡의 표식이 대신한다.
 * 화면 밖이거나 재생 곡이 이 겹 밖이면 {@link drawMeAway} 의 **옅은 점 + 화살촉**으로 갈린다 —
 * 글씨로 사정을 설명하지 않는다. 제자리 표식(링 + 다이아)과 눈으로 바로 갈라져야 한다.
 */
function drawMe(g: CanvasRenderingContext2D, e: MapEngine) {
  // 전환 중에는 두 겹이 겹쳐 있어 내 자리를 하나로 찍을 수 없다 — 끝나면 다시 나온다
  if (e.anim || e.follow || e.myId == null || e.constellationActive()) return;
  // 화면 밖이면 자리 대신 가장자리 화살표를 그린다
  const off = e.meArrow();
  if (off) {
    drawMeAway(g, e, off);
    return;
  }
  // 주변 탐색 중 고리 안 곡에 앉아 있으면 연출 자리에 그린다 (S15P21A405-288)
  const { px, py, from, onRing } = e.meScreen();
  // 날아오는 중이면 지나온 자리에 꼬리를 남긴다 (친구 우주선처럼)
  if (from) {
    const tx = px - from.px;
    const ty = py - from.py;
    const td = Math.hypot(tx, ty) || 1;
    const len = td * ME_FLIGHT.trail;
    const grad = g.createLinearGradient(px - (tx / td) * len, py - (ty / td) * len, px, py);
    grad.addColorStop(0, "rgba(79,227,206,0)");
    grad.addColorStop(1, "rgba(79,227,206,.75)");
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = grad;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(px - (tx / td) * len, py - (ty / td) * len);
    g.lineTo(px, py);
    g.stroke();
    g.globalCompositeOperation = "source-over";
  }
  /**
   * **누가 나를 따라오면 나도 우주선이다** (S15P21A405-557).
   *
   * 예전에는 내가 따라갈 때만 우주선 뒤에 줄이 섰다 — 인솔자 쪽은 제 선단을 볼 길이 없어서
   * 혼자 다니는 것과 구분이 안 됐다. 그리는 모양은 따라갈 때와 같고 '나' 자리만 다르다.
   *
   * 기수는 **날아온 방향**을 쓴다. 서 있을 때는 방향이랄 것이 없으므로 위를 본다.
   */
  if (e.myRiders > 0) {
    const ang = from ? Math.atan2(py - from.py, px - from.px) + Math.PI / 2 : 0;
    drawShip(g, px, py, ME_SHIP_R, ang, e.time);
    drawQueue(g, px, py, ME_SHIP_R, ang, e.time, e.myRiders);
    g.globalCompositeOperation = "source-over";
  } else {
    drawMeMarker(g, px, py, e.time);
    g.globalCompositeOperation = "source-over";
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(79,227,206,.95)";
  g.font = `600 11.5px ${FONTS.mono}`;
  // 고리 위에서는 별 아래에 제목·순위 라벨이 붙어 있으니 '나' 는 위로 올린다
  g.fillText("나", px, onRing ? py - 22 : py + 24);
}

/**
 * 고스트별 (MAP-12) — 이 겹에 없는 곡을 "범위 밖에 있다"고 치고 그린다.
 * 실제 별과 헷갈리지 않게 점선 링에 옅은 색, 곁에 "다른 갈래에 있는 곡" 라벨을 단다.
 */
function drawGhost(g: CanvasRenderingContext2D, e: MapEngine) {
  const p = e.ghostPos();
  if (!p || !e.ghost) return;
  const i = e.songs.findIndex((x) => x.musicId === e.ghost!.musicId);
  if (i < 0) return;
  const s = e.songs[i];
  const kk = e.ghostK();
  const k = kk * GHOST.alpha;
  const f = e.freeRect();
  // 표식에서 화면 밖을 향하는 방향 (테두리에 붙어 있으므로 중앙 반대쪽이 곧 바깥이다)
  let ox = p.x - f.cx;
  let oy = p.y - f.cy;
  const od = Math.hypot(ox, oy) || 1;
  ox /= od;
  oy /= od;
  // 라벨은 화면 안쪽으로 — 테두리 밖으로 나가면 잘린다
  const labelDir = oy > 0.35 ? -1 : 1;
  // 등장: 화면 밖에서 테두리 자리로 밀려 들어오며 한 번 부풀고, 자리 잡은 뒤로는 계속 오르내린다
  const slide = (1 - kk) * GHOST.enterSlidePx;
  const bob = Math.sin(e.time * GHOST.bob.speed) * GHOST.bob.px * kk;
  const pop = 1 + Math.sin(kk * Math.PI) * GHOST.popScale;
  const cx = p.x + ox * (slide + bob);
  const cy = p.y + oy * (slide + bob);
  const rr = (14 + Math.sin(e.time * GHOST.bob.speed) * 2.2) * pop;

  g.globalCompositeOperation = "lighter";
  g.globalAlpha = k;
  const gr = 26 * pop;
  g.drawImage(glowSprites()[starColorIdx(s)], cx - gr, cy - gr, gr * 2, gr * 2);

  // 등장 파문 — 한 번 퍼지고 사라진다
  if (kk < 1) {
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = (1 - kk) * 0.5;
    g.strokeStyle = rgba(starRgb(s), 0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, rr + (1 - kk) * 34, 0, 6.284);
    g.stroke();
  }

  g.globalCompositeOperation = "source-over";
  g.globalAlpha = k * 1.6;
  g.setLineDash([4, 5]);
  g.strokeStyle = rgba(starRgb(s), 0.9);
  g.lineWidth = 1.3;
  g.beginPath();
  g.arc(cx, cy, rr, 0, 6.284);
  g.stroke();
  // 안쪽에 옅은 겹 링 하나 더 — 실제 별보다 흐릿하게 읽히도록
  g.globalAlpha = k * 0.7;
  g.beginPath();
  g.arc(cx, cy, rr * 0.62, 0, 6.284);
  g.stroke();
  g.setLineDash([]);

  // 화면 밖을 가리키는 화살촉 — "이 방향 더 바깥에 있다"
  g.globalAlpha = k * 1.9;
  g.fillStyle = rgba(starRgb(s), 0.9);
  const ax = cx + ox * (rr + 6);
  const ay = cy + oy * (rr + 6);
  g.beginPath();
  g.moveTo(ax + ox * 8, ay + oy * 8);
  g.lineTo(ax - oy * 5.5, ay + ox * 5.5);
  g.lineTo(ax + oy * 5.5, ay - ox * 5.5);
  g.closePath();
  g.fill();

  g.globalAlpha = kk;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const label = "이 영역에 없는 곡";
  g.font = `600 11px ${FONTS.mono}`;
  const labelW = g.measureText(label).width;
  g.font = `500 ${MAP_TITLE_PX.label}px ${FONTS.body}`;
  const title = fitText(g, s.title, 150);
  const tw = Math.max(labelW, g.measureText(title).width);
  const ly = labelDir > 0 ? cy + rr + 5 : cy - rr - 41;
  const lx = clamp(cx, f.x0 + tw / 2 + 12, f.x1 - tw / 2 - 12);
  g.fillStyle = MAP_COLORS.labelBg;
  roundRect(g, lx - tw / 2 - 7, ly, tw + 14, 18, 6);
  g.fill();
  g.fillStyle = "rgba(233,241,255,.82)";
  g.fillText(title, lx, ly + 9);
  g.font = `600 11px ${FONTS.mono}`;
  g.fillStyle = "rgba(147,164,196,.8)";
  g.fillText(label, lx, ly + 25);
}

/** 선택 곡 강조 링 */
function drawSelected(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.selectedId == null || e.probe || !e.isAlive(e.selectedId)) return;
  const w = e.worldOf(e.selectedId)!;
  const { px, py } = e.worldToScreen(w.x, w.y, e.cam, e.parOf(e.selectedId));
  const song = e.songs.find((s) => s.musicId === e.selectedId)!;
  const rr = 19 + Math.sin(e.time * 2.2) * 2.4;
  g.globalCompositeOperation = "lighter";
  g.beginPath();
  g.arc(px, py, rr, 0, 6.284);
  g.strokeStyle = rgba(starRgb(song), 0.85);
  g.lineWidth = 1.6;
  g.stroke();
  g.globalCompositeOperation = "source-over";
}

/**
 * 별을 꾹 누르는 중 — 그 별 둘레로 링이 차오른다 (S15P21A405-288). 다 차면 그 별 주변으로 파고든다.
 * 휠 압력(drawPressure)과 같은 뜻의 다른 손짓이라 같은 청록을 쓴다
 */
function drawHold(g: CanvasRenderingContext2D, e: MapEngine) {
  const h = e.hold;
  if (!h) return;
  const p = e.screenPosOf(h.id);
  if (!p) return;
  const k = e.holdK();
  if (k < 0.02) return;
  const a0 = -Math.PI / 2;
  g.globalCompositeOperation = "lighter";
  // 바탕 링 — 어디까지 차야 하는지
  g.beginPath();
  g.arc(p.x, p.y, HOLD.r, 0, 6.284);
  g.strokeStyle = `rgba(79,227,206,${0.18 * Math.min(1, k * 4)})`;
  g.lineWidth = 1;
  g.stroke();
  // 차오르는 호
  g.beginPath();
  g.arc(p.x, p.y, HOLD.r, a0, a0 + 6.284 * k);
  g.strokeStyle = `rgba(79,227,206,${0.55 + 0.4 * k})`;
  g.lineWidth = 2.2;
  g.lineCap = "round";
  g.stroke();
  g.lineCap = "butt";
  // 안쪽이 서서히 밝아진다 — 파고들 준비가 되는 느낌
  const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, HOLD.r);
  glow.addColorStop(0, `rgba(79,227,206,${0.22 * k * k})`);
  glow.addColorStop(1, "rgba(79,227,206,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(p.x, p.y, HOLD.r, 0, 6.284);
  g.fill();
  g.globalCompositeOperation = "source-over";
}

/** 스크롤 압력 — 원 가이드 없이 문구와 얇은 게이지만 */
function drawPressure(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.anim || e.pressure < 0.01) return;
  const f = e.freeRect();
  const dir = e.pressureDir;
  const label = dir > 0 ? `↓ ${LAYER_NAMES[Math.min(e.layer + 1, LAYER_NAMES.length - 1)]}으로 파고들기` : `↑ ${LAYER_NAMES[Math.max(e.layer - 1, 0)]}으로 떠오르기`;
  const color = dir > 0 ? "#4fe3ce" : "#ffc46b";
  const y = f.cy - Math.min(e.W, e.H) * 0.26 - 24;
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = Math.min(1, e.pressure * 1.5);
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `600 14px ${FONTS.body}`;
  g.fillText(label, f.cx, y);
  const bw = 160;
  g.fillStyle = "rgba(255,255,255,.12)";
  g.fillRect(f.cx - bw / 2, y + 14, bw, 3);
  g.fillStyle = color;
  g.fillRect(f.cx - bw / 2, y + 14, bw * e.pressure, 3);
  g.globalAlpha = 1;
}

/** 한 프레임 */
export function drawMap(g: CanvasRenderingContext2D, e: MapEngine, currentMusicId: number | null) {
  // 별을 그릴 때 쓰는 시계와 같아야 한다 — `appear` 가 이 잣대로 `last` 를 적는다
  forgetStale(e.time);
  // 링크 히트 영역은 이 프레임에 글씨를 그린 곳만 — 안 그리면 누를 수도 없어야 한다
  e.hopLink = null;
  /**
   * **주변 탐색의 확대는 여기 한 곳이다** (S15P21A405-593).
   *
   * 고리 반지름만 키우던 때는 중심 별도 제목도 배경도 그대로라 살만 길어졌다 — 확대가 아니라
   * "줄이 늘어난 것" 으로 보였다. 화면을 통째로 키우면 배경 별밭·별 크기·글씨·선이 같은
   * 비율로 커진다. 그리는 좌표는 아무 데도 안 고쳐도 된다.
   *
   * 되돌리는 쪽은 {@link MapEngine.unview} 하나다 — 클릭 판정이 보는 `visible`·`hopLink` 는
   * 확대 전 자리에 그대로 남으므로, 눌린 점만 되돌리면 그리기와 클릭이 안 어긋난다.
   */
  const view = e.probeView();
  if (view) {
    g.save();
    g.translate(view.cx, view.cy);
    g.scale(view.z, view.z);
    g.translate(-view.cx, -view.cy);
  }
  // 전환 중에는 배경 깊이(어둡기·별밭)도 두 겹 사이를 건너간다 — 끝나는 순간 툭 바뀌면 그것부터 눈에 띈다
  drawBackground(g, e, depthOf(e));
  if (e.anim) {
    // 나가는 겹은 **별만** 훅 지나가게 그린다. 성운까지 겹쳐 그리면 가산 합성이라 화면이 하얗게 뜬다
    drawStars(g, e, true);
  }
  drawNebula(g, e);
  drawStars(g, e);
  drawCovers(g, e);

  // 지도 위 요소(사람·선택·고스트·내 위치·호버)는 전부 오버레이보다 **뒤**에 —
  // 별자리·주변 탐색이 켜지면 다 같이 어두워진다
  drawFriends(g, e);
  drawSelected(g, e);
  drawGhost(g, e);
  // 내 표식도 주변 탐색의 어둠에 덮인다 (S15P21A405-408). 고리를 펼치면 봐야 할 것은 이웃 별
  // 열두 개고, 그 사이에서 혼자 밝은 표식은 고를 것이 아니면서 시선을 끈다.
  // S15P21A405-288 에서는 반대로 골랐었다 — 고리 위를 옮겨 다니는 우주선을 계속 보이게 하려던 것.
  // 위치는 `meScreen` 이 여전히 고리 위로 잡아 주므로, 덮인 채로도 어디 앉았는지는 읽힌다.
  drawMe(g, e);

  drawConstellation(g, e, currentMusicId);
  drawProbe(g, e);
  drawHold(g, e);
  drawPressure(g, e);
  if (view) g.restore();
}
