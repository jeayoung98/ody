import { CONSTELLATION, COVER_COUNT, GHOST, LAYER_COUNT, LAYER_DEPTH, LAYER_NAMES, ME_FLIGHT, STAR_SIZE, STAR_VIEW } from "@/constants";
import { FONTS, MAP_COLORS, NEBULA_WASH, genreIdx, genreRgb, rgba } from "@/constants/design-tokens";
import type { MapEngine } from "../engine/map-engine";
import { drawFriends } from "./draw-friends";
import { coverFor, fitText, glowSprites, puffFor, roundRect, skyStars, mulberry32 } from "./sprites";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** 가중치 → 0~1 등급 (로그 스케일, 재생수 10^2.6 ~ 10^6.8) */
function magOf(weight: number) {
  return clamp((Math.log10(Math.max(1, weight)) - 2.6) / 4.2, 0, 1);
}
/** 밝기는 크기와 느슨하게만 연동 */
function lumOf(i: number, mag: number) {
  return clamp(0.28 * mag + 0.72 * Math.pow(((i * 7919) % 1000) / 1000, 0.8), 0, 1);
}
function twinkle(id: number, t: number) {
  const dep = 0.05 + (id % 13) / 34;
  const spd = 0.5 + (id % 23) / 9;
  return 1 - dep * (0.5 + 0.5 * Math.sin(t * spd + id * 0.7));
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
  e.last = t;
  if (seenAt.size > 4000 && t - e.first > 3) seenAt.delete(id);
  return Math.min(1, ((t - e.first) * 1000) / STAR_VIEW.appearMs);
}

function drawBackground(g: CanvasRenderingContext2D, W: number, H: number, t: number, depth: number) {
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
  const field = (ox: number, oy: number, sizeK: number, aK: number, n = sky.length) => {
    for (let k = 0; k < n; k++) {
      const bg = sky[k];
      const px = ((((bg.u - ox) % 1) + 1) % 1) * (W + 64) - 32;
      const py = ((((bg.v - oy) % 1) + 1) % 1) * (H + 64) - 32;
      const d = (1.3 + Math.pow(bg.m, 1.5) * 4.2) * sizeK;
      g.globalAlpha = (0.06 + bg.lum * 0.19) * (0.55 + 0.45 * Math.sin(t * (0.35 + (bg.i % 17) / 14) + bg.i)) * aK;
      g.drawImage(spr[bg.spr], px - d / 2, py - d / 2, d, d);
    }
  };
  field(t * 0.0052, -t * 0.0019, 1, dim);
  /**
   * 0겹(우주)을 뺀 겹에는 원경 별밭을 두 겹 더 깐다.
   * 파고들수록 상주 곡은 화면 가운데로 모이는데, 그 바깥이 빈 하늘이면 "확대해 들어왔다"가 아니라
   * "곡이 줄었다"로 읽힌다. 같은 별밭을 위치·크기·밝기만 어긋나게 겹쳐 화면 전체를 배경 별로 채운다.
   * farK 는 0겹 → 1겹 한 칸에서 0 → 1 로 차오른다 — 전환 중 깊이가 소수라 별밭이 툭 켜지지 않는다.
   */
  const farK = Math.min(1, depth * (LAYER_COUNT - 1));
  if (farK > 0.01) {
    field(t * 0.0026 + 0.37, -t * 0.0009 + 0.61, 0.92, dim * LAYER_DEPTH.farFieldAlpha * farK);
    field(t * 0.0013 + 0.71, -t * 0.0004 + 0.23, 0.8, dim * LAYER_DEPTH.farFieldAlpha * 0.82 * farK, Math.round(sky.length * 0.7));
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
  const R = clamp(0.55 * e.cam.s, 60, Math.max(W, H) * 0.8);
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
      g.drawImage(puffFor(q.k, s.genreId), px + q.dx * R - rr, py + q.dy * R - rr, rr * 2, rr * 2);
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
    if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
    const s = e.songs[i];
    if (pset?.has(s.musicId) || cset?.has(s.musicId)) continue; // 프로브·별자리 곡은 따로 그린다
    const mag = magOf(s.weight);
    const on = e.chosen.has(i);
    let d: number;
    let alpha: number;
    if (e.selectedId === s.musicId) {
      d = 15 + Math.pow(mag, 1.6) * 20;
      alpha = 1;
    } else if (on) {
      d = (STAR_SIZE.min + Math.pow(mag, 1.75) * (STAR_SIZE.max - STAR_SIZE.min)) * grow;
      // 새로 도드라진 별은 툭 튀지 않게 380ms 동안 밝아진다 (프로토타입 appear)
      alpha = (0.42 + lumOf(i, mag) * 0.58) * twinkle(s.musicId, t) * appear(s.musicId, t);
    } else {
      // 배경 별: 작고, 밝기는 별마다 다르고, 하늘처럼 함께 흐른다 (깊이만큼 시차)
      d = (2.8 + Math.pow(mag, 1.6) * 5.6) * grow;
      alpha = (0.14 + lumOf(i, mag) * 0.34) * twinkle(s.musicId, t);
      const drift = 0.34 + e.z[i] * 0.05;
      px += swx * drift;
      py += swy * drift;
    }
    if (!s.playable) alpha *= 0.5;
    alpha *= a0;
    if (e.hoverId === s.musicId) alpha = Math.min(1, alpha + 0.3);
    g.globalAlpha = alpha;
    g.drawImage(spr[genreIdx(s.genreId)], px - d / 2, py - d / 2, d, d);
    // 전환 중 나가는 별은 지나간 자리에 잔상을 남긴다 — 가장자리로 훅 빠지는 게 보이게
    if (out && e.anim) {
      const f2 = e.freeRect();
      const tx = px - f2.cx;
      const ty = py - f2.cy;
      const td = Math.hypot(tx, ty) || 1;
      const len = Math.min(90, td * 0.22) * (e.anim.dir > 0 ? 1 : -1);
      g.globalAlpha = alpha * 0.5;
      g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
      g.lineWidth = Math.max(0.8, d * 0.18);
      g.beginPath();
      g.moveTo(px - (tx / td) * len, py - (ty / td) * len);
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
        g.strokeStyle = rgba(genreRgb(s.genreId), 0.22 * alpha);
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

/** 대표성이 가장 높은 몇 곡은 앨범 커버로 띄운다 */
function drawCovers(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.anim) return;
  const f = e.freeRect();
  const M = 42;
  const grow = clamp(0.86 + Math.log(Math.max(1, e.cam.s / 100)) * 0.13, 0.85, 1.35);
  if (e.coverAlpha < 0.01) return;
  // 커버는 이 레이어의 대표곡(백엔드 선별) 중 화면 안에 있는 곡. 부족하면 격자 대표곡으로 채운다
  const candidates = new Set<number>();
  for (let i = 0; i < e.N; i++) if (e.subset[i] && e.repIds.has(e.songs[i].musicId)) candidates.add(i);
  if (candidates.size < COVER_COUNT.far) for (const i of e.chosen) candidates.add(i);
  const list = [...candidates]
    .map((i) => ({ i, px: e.pos[i * 2], py: e.pos[i * 2 + 1], s: e.songs[i] }))
    .filter((it) => it.px > f.x0 + M && it.px < f.x1 - M && it.py > f.y0 + M && it.py < f.y1 - M)
    .sort((a, b) => b.s.weight - a.s.weight);
  const n = e.cam.s < 160 ? COVER_COUNT.far : COVER_COUNT.near;
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = e.coverAlpha;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `500 9.5px ${FONTS.body}`;
  for (let k = 0; k < Math.min(n, list.length); k++) {
    const it = list[k];
    if (e.hoverId === it.s.musicId || e.selectedId === it.s.musicId) continue;
    const mag = magOf(it.s.weight);
    const S = (19 + Math.pow(mag, 1.4) * 14) * grow;
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
    g.fillStyle = `rgba(233,241,255,${(0.34 + mag * 0.34).toFixed(2)})`;
    g.fillText(fitText(g, it.s.title, 88), it.px, it.py + S / 2 + 9);
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
    g.drawImage(spr[genreIdx(s.genreId)], p.x - d / 2, p.y - d / 2, d, d);
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
      g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(p.x, p.y, 13, 0, 6.284);
      g.stroke();
    }
  });

  // 라벨: 제목만 (순번 없음). 진행도로 옅어지되 바닥을 둬서 아직 안 들은 곡도 읽힌다
  g.textAlign = "center";
  g.textBaseline = "middle";
  pts.forEach((p, i) => {
    const s = e.songs[e.songs.findIndex((x) => x.musicId === p.id)];
    g.globalAlpha = k * Math.max(CONSTELLATION.labelMinAlpha, alphaOf(i));
    g.font = `600 11px ${FONTS.body}`;
    const title = fitText(g, s.title, 120);
    const tw = g.measureText(title).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, p.x - tw / 2 - 6, p.y + 12, tw + 12, 17, 5);
    g.fill();
    g.fillStyle = "#dbe4f2";
    g.fillText(title, p.x, p.y + 21);
  });

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
  const center = e.probePos(p.centerId);
  if (!center) return;
  const tx = center.x;
  const ty = center.y;

  // 전체를 어둡게 덮는다 (진행도에 따라)
  g.globalCompositeOperation = "source-over";
  const f = e.freeRect();
  const Rv = Math.min(f.x1 - f.x0, f.y1 - f.y0) * 0.5;
  const vg = g.createRadialGradient(tx, ty, Rv * 0.2, tx, ty, Rv * 1.9);
  vg.addColorStop(0, `rgba(4,6,13,${0.55 * k})`);
  vg.addColorStop(0.55, `rgba(4,6,13,${0.78 * k})`);
  vg.addColorStop(1, `rgba(4,6,13,${0.92 * k})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, e.W, e.H);

  // 기준곡 → 유사곡 별자리선
  g.save();
  g.globalCompositeOperation = "lighter";
  g.setLineDash([3, 5]);
  g.lineDashOffset = -((e.time * 16) % 8);
  g.lineWidth = 1;
  const nodes: { id: number; x: number; y: number; rank: number }[] = [];
  p.ids.forEach((id, rank) => {
    if (!e.isAlive(id)) return;
    const pp = e.probePos(id);
    if (!pp) return;
    nodes.push({ id, x: pp.x, y: pp.y, rank });
    g.strokeStyle = `rgba(150,180,240,${0.3 * k})`;
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(pp.x, pp.y);
    g.stroke();
  });
  g.setLineDash([]);
  g.restore();

  // 유사곡 별 (밝게) + 순위·제목
  g.globalCompositeOperation = "lighter";
  for (const n of nodes) {
    const s = e.songs.find((x) => x.musicId === n.id)!;
    const d = 22 + (1 - n.rank / Math.max(1, nodes.length)) * 10;
    g.globalAlpha = 0.95 * k * (s.playable ? 1 : 0.55);
    g.drawImage(spr[genreIdx(s.genreId)], n.x - d / 2, n.y - d / 2, d, d);
    g.globalAlpha = k;
    g.fillStyle = MAP_COLORS.core;
    g.beginPath();
    g.arc(n.x, n.y, 2.4, 0, 6.284);
    g.fill();
    if (e.hoverId === n.id || e.selectedId === n.id) {
      g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(n.x, n.y, 12, 0, 6.284);
      g.stroke();
    }
  }
  g.globalCompositeOperation = "source-over";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const n of nodes) {
    const s = e.songs.find((x) => x.musicId === n.id)!;
    g.globalAlpha = k;
    g.font = `500 10.5px ${FONTS.body}`;
    const title = fitText(g, s.title, 110);
    const tw = g.measureText(title).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, n.x - tw / 2 - 6, n.y + 13, tw + 12, 17, 5);
    g.fill();
    g.fillStyle = "rgba(233,241,255,.92)";
    g.fillText(title, n.x, n.y + 21.5);
    g.font = `500 8.5px ${FONTS.mono}`;
    g.fillStyle = "rgba(147,164,196,.7)";
    g.fillText(`#${n.rank + 1} · ${s.artist ?? ""}`, n.x, n.y + 34);
  }
  g.globalAlpha = 1;

  // 기준 곡 강조 + 라벨
  const song = e.songs.find((s) => s.musicId === p.centerId)!;
  const frgb = genreRgb(song.genreId);
  const rr = 19 + Math.sin(e.time * 2.2) * 2.4;
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = k;
  g.drawImage(spr[genreIdx(song.genreId)], tx - 22, ty - 22, 44, 44);
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
  g.font = `600 12.5px ${FONTS.body}`;
  const tw = g.measureText(song.title).width;
  g.fillStyle = MAP_COLORS.labelBg;
  roundRect(g, tx - tw / 2 - 7, ty + rr + 6, tw + 14, 19, 6);
  g.fill();
  g.fillStyle = "rgba(233,241,255,.98)";
  g.fillText(song.title, tx, ty + rr + 15.5);
  g.font = `500 9.5px ${FONTS.mono}`;
  g.fillStyle = "rgba(147,164,196,.62)";
  g.fillText(`NEARBY · 유사도 상위 ${p.ids.length}곡 · ${LAYER_NAMES[e.layer]}`, tx, ty + rr + 30);
  g.globalAlpha = 1;
}

/**
 * 내 위치 표식 — 맥동하는 두 겹 링 + 다이아몬드.
 * 지도의 "나"와 별자리 뷰의 "지금 듣는 곡" 둘 다 이걸 쓴다 (PATH-01).
 */
function drawMeMarker(g: CanvasRenderingContext2D, px: number, py: number, t: number) {
  const rr = 13 + Math.sin(t * 1.6) * 2.6;
  g.save();
  g.translate(px, py);
  g.globalCompositeOperation = "lighter";
  g.beginPath();
  g.arc(0, 0, rr, 0, 6.284);
  g.strokeStyle = MAP_COLORS.meRing;
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, rr * 0.62, 0, 6.284);
  g.strokeStyle = MAP_COLORS.meRingInner;
  g.stroke();
  g.rotate(Math.PI / 4);
  g.fillStyle = MAP_COLORS.me;
  g.fillRect(-4, -4, 8, 8);
  g.restore();
}

/**
 * 내 좌표 (MAP-08). 탑승 중에는 선미의 '나' 헬멧이, 별자리 뷰에서는 대형 안 현재 곡의 표식이 대신한다.
 * 재생 곡이 이 겹 밖이면 자리는 그대로 두고 라벨로 그 사실을 알린다.
 */
function drawMe(g: CanvasRenderingContext2D, e: MapEngine) {
  // 전환 중에는 두 겹이 겹쳐 있어 내 자리를 하나로 찍을 수 없다 — 끝나면 다시 나온다
  if (e.anim || e.follow || e.myId == null || e.constellationActive()) return;
  const edge = e.meEdgePos();
  if (edge) {
    // 내 자리가 지금 보는 영역 밖이다 — 구름 밖에 방향만 찍어두고 배너로 찾아가게 한다
    drawMeMarker(g, edge.x, edge.y, e.time);
    g.globalCompositeOperation = "source-over";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 9.5px ${FONTS.mono}`;
    const label = "내 위치 · 화면 밖";
    const tw = g.measureText(label).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, edge.x - tw / 2 - 6, edge.y + 16, tw + 12, 16, 5);
    g.fill();
    g.fillStyle = "rgba(79,227,206,.9)";
    g.fillText(label, edge.x, edge.y + 24);
    return;
  }
  const { px, py } = e.worldToScreen(e.me.x, e.me.y);
  const elsewhere = e.playingElsewhere();
  // 날아오는 중이면 지나온 자리에 꼬리를 남긴다 (친구 우주선처럼)
  const fl = e.meFlight;
  if (fl) {
    const from = e.worldToScreen(fl.ax, fl.ay);
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
  drawMeMarker(g, px, py, e.time);
  g.globalCompositeOperation = "source-over";
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (elsewhere) {
    // 지금 듣는 곡이 이 겹에 없다 — 여기가 내 자리이고, 그 곡은 다른 갈래에 있다
    g.font = `600 9.5px ${FONTS.mono}`;
    const label = "다른 갈래에서 재생 중";
    const tw = g.measureText(label).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, px - tw / 2 - 6, py + 16, tw + 12, 16, 5);
    g.fill();
    g.fillStyle = "rgba(166,124,255,.95)";
    g.fillText(label, px, py + 24);
  } else {
    g.fillStyle = "rgba(79,227,206,.95)";
    g.font = `600 10px ${FONTS.mono}`;
    g.fillText("나", px, py + 24);
  }
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
  g.drawImage(glowSprites()[genreIdx(s.genreId)], cx - gr, cy - gr, gr * 2, gr * 2);

  // 등장 파문 — 한 번 퍼지고 사라진다
  if (kk < 1) {
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = (1 - kk) * 0.5;
    g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, rr + (1 - kk) * 34, 0, 6.284);
    g.stroke();
  }

  g.globalCompositeOperation = "source-over";
  g.globalAlpha = k * 1.6;
  g.setLineDash([4, 5]);
  g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
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
  g.fillStyle = rgba(genreRgb(s.genreId), 0.9);
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
  g.font = `600 9px ${FONTS.mono}`;
  const labelW = g.measureText(label).width;
  g.font = `500 10.5px ${FONTS.body}`;
  const title = fitText(g, s.title, 130);
  const tw = Math.max(labelW, g.measureText(title).width);
  const ly = labelDir > 0 ? cy + rr + 5 : cy - rr - 41;
  const lx = clamp(cx, f.x0 + tw / 2 + 12, f.x1 - tw / 2 - 12);
  g.fillStyle = MAP_COLORS.labelBg;
  roundRect(g, lx - tw / 2 - 7, ly, tw + 14, 18, 6);
  g.fill();
  g.fillStyle = "rgba(233,241,255,.82)";
  g.fillText(title, lx, ly + 9);
  g.font = `600 9px ${FONTS.mono}`;
  g.fillStyle = "rgba(147,164,196,.8)";
  g.fillText(label, lx, ly + 25);
}

/** 선택 곡 강조 링 */
function drawSelected(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.selectedId == null || e.probe || !e.isAlive(e.selectedId)) return;
  const w = e.worldOf(e.selectedId)!;
  const { px, py } = e.worldToScreen(w.x, w.y);
  const song = e.songs.find((s) => s.musicId === e.selectedId)!;
  const rr = 19 + Math.sin(e.time * 2.2) * 2.4;
  g.globalCompositeOperation = "lighter";
  g.beginPath();
  g.arc(px, py, rr, 0, 6.284);
  g.strokeStyle = rgba(genreRgb(song.genreId), 0.85);
  g.lineWidth = 1.6;
  g.stroke();
  g.globalCompositeOperation = "source-over";
}

/** 호버 카드 — 커버와 기본 정보 */
function drawHover(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.hoverId == null) return;
  const v = e.visible.find((x) => e.songs[x.i].musicId === e.hoverId);
  if (!v) return;
  const s = e.songs[v.i];
  const w = 284;
  const h = 76;
  const f = e.freeRect();
  const bx = clamp(v.px - w / 2, Math.max(8, f.x0 + 8), Math.max(8, Math.min(e.W, f.x1) - w - 8));
  const top = Math.max(8, f.y0 + 6);
  const bot = Math.max(top, Math.min(e.H, f.y1) - h - 6);
  const by = clamp(v.py - h - 22 < top ? v.py + 22 : v.py - h - 22, top, bot);
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(7,11,21,.95)";
  g.beginPath();
  g.roundRect(bx, by, w, h, 12);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,.17)";
  g.lineWidth = 1;
  g.stroke();
  const S = 54;
  const ax = bx + 11;
  const ay = by + 11;
  g.save();
  g.beginPath();
  g.roundRect(ax, ay, S, S, 8);
  g.clip();
  g.drawImage(coverFor(s), ax, ay, S, S);
  g.restore();
  g.beginPath();
  g.roundRect(ax, ay, S, S, 8);
  g.strokeStyle = "rgba(255,255,255,.15)";
  g.stroke();
  const tx = ax + S + 12;
  const tw = w - S - 36;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = `600 12.5px ${FONTS.body}`;
  g.fillStyle = "#e9f1ff";
  g.fillText(fitText(g, s.title, tw), tx, by + 28);
  g.font = `400 10.5px ${FONTS.body}`;
  g.fillStyle = "#93a4c4";
  g.fillText(fitText(g, s.artist ?? "", tw), tx, by + 44);
  g.font = `500 8.5px ${FONTS.mono}`;
  g.fillStyle = s.playable ? "#5a6b8c" : "#ffc46b";
  g.fillText(fitText(g, `▶ ${s.weight.toLocaleString()}${s.playable ? "" : " · 재생 불가"}`, tw), tx, by + 61);
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
  g.font = `600 13px ${FONTS.body}`;
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
  // 전환 중에는 배경 깊이(어둡기·원경 별밭)도 두 겹 사이를 건너간다 — 끝나는 순간 툭 바뀌면 그것부터 눈에 띈다
  const depthLayer = e.anim ? e.layer + (e.anim.layer - e.layer) * e.morphT : e.layer;
  drawBackground(g, e.W, e.H, e.time, depthLayer / (LAYER_COUNT - 1));
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
  drawMe(g, e);
  drawHover(g, e);

  drawConstellation(g, e, currentMusicId);
  drawProbe(g, e);
  drawPressure(g, e);
}
