import { CONSTELLATION, COVER_COUNT, LAYER_COUNT, LAYER_DEPTH, LAYER_NAMES, STAR_SIZE } from "@/constants";
import { FONTS, GENRE_COLORS, MAP_COLORS, NEBULA_WASH, genreRgb, rgba } from "@/constants/design-tokens";
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
  const sox = t * 0.0052;
  const soy = -t * 0.0019;
  const sky = skyStars();
  const skyN = Math.round(sky.length * (1 - depth * LAYER_DEPTH.maxStarThin));
  for (let k = 0; k < skyN; k++) {
    const bg = sky[k];
    const px = ((((bg.u - sox) % 1) + 1) % 1) * (W + 64) - 32;
    const py = ((((bg.v - soy) % 1) + 1) % 1) * (H + 64) - 32;
    const d = 1.3 + Math.pow(bg.m, 1.5) * 4.2;
    g.globalAlpha = (0.06 + bg.lum * 0.19) * (0.55 + 0.45 * Math.sin(t * (0.35 + (bg.i % 17) / 14) + bg.i));
    g.drawImage(spr[bg.spr], px - d / 2, py - d / 2, d, d);
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
function drawNebula(g: CanvasRenderingContext2D, e: MapEngine) {
  const W = e.W;
  const H = e.H;
  const R = clamp(0.55 * e.cam.s, 60, Math.max(W, H) * 0.8);
  g.globalCompositeOperation = "lighter";
  // 앵커: 190곡마다 하나 (결정적)
  for (let i = 0; i < e.N; i += 190) {
    if (e.alpha[i] < 0.05) continue;
    const s = e.songs[i];
    const px = e.pos[i * 2];
    const py = e.pos[i * 2 + 1];
    if (px < -R * 1.7 || px > W + R * 1.7 || py < -R * 1.7 || py > H + R * 1.7) continue;
    for (const q of puffsOf(s.musicId)) {
      const rr = R * q.sc;
      g.globalAlpha = q.a * e.alpha[i];
      g.drawImage(puffFor(q.k, s.genreId), px + q.dx * R - rr, py + q.dy * R - rr, rr * 2, rr * 2);
    }
  }
  g.globalAlpha = 1;
}

function drawStars(g: CanvasRenderingContext2D, e: MapEngine) {
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
    const a0 = e.alpha[i];
    if (a0 < 0.01) continue;
    let px = e.pos[i * 2];
    let py = e.pos[i * 2 + 1];
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
      alpha = (0.42 + lumOf(i, mag) * 0.58) * twinkle(s.musicId, t);
    } else {
      // 배경 별: 작고, 밝기는 별마다 다르고, 하늘처럼 함께 흐른다
      d = (2.8 + Math.pow(mag, 1.6) * 5.6) * grow;
      alpha = (0.14 + lumOf(i, mag) * 0.34) * twinkle(s.musicId, t);
      px += swx * 0.34;
      py += swy * 0.34;
    }
    if (!s.playable) alpha *= 0.5;
    alpha *= a0;
    if (e.hoverId === s.musicId) alpha = Math.min(1, alpha + 0.3);
    g.globalAlpha = alpha;
    g.drawImage(spr[s.genreId % GENRE_COLORS.length], px - d / 2, py - d / 2, d, d);
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
 * 별자리 뷰 (PATH-01) — 여정·플레이리스트 곡을 최적 레이어로 재투영해 화면에 크게 맞춘 연출 뷰.
 * 위치는 엔진 constellationPos (실제 위치 → 배치 위치로 보간). 배경은 어둡게 덮고 곡·선만 밝게.
 */
/**
 * 흐린 별자리 — 재생 중이던 별자리를 지우지 않고 옅은 선과 점으로만 남긴다 (PATH-01).
 * 배경을 덮지도, 라벨을 붙이지도 않는다. 위에 또렷한 별자리가 얹힌다.
 */
function drawGhostConstellation(g: CanvasRenderingContext2D, e: MapEngine) {
  if (!e.ghost) return;
  const k = e.ghostK() * CONSTELLATION.ghostAlpha;
  if (k < 0.01) return;
  const pts: { x: number; y: number }[] = [];
  for (const id of e.ghost.ids) {
    const p = e.ghostPos(id);
    if (p) pts.push(p);
  }
  if (pts.length < 2) return;

  g.globalCompositeOperation = "lighter";
  g.globalAlpha = k;
  g.strokeStyle = MAP_COLORS.routeStops[1];
  g.lineWidth = 1.5;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.setLineDash([5, 6]);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = MAP_COLORS.routeStops[1];
  for (const p of pts) {
    g.beginPath();
    g.arc(p.x, p.y, 2.2, 0, 6.284);
    g.fill();
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

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

  // 배경 어둡게
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(4,6,13,${CONSTELLATION.dim * k})`;
  g.fillRect(0, 0, e.W, e.H);

  // 경로선 (청록→파랑→보라)
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = k;
  const gr = g.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
  gr.addColorStop(0, MAP_COLORS.routeStops[0]);
  gr.addColorStop(0.5, MAP_COLORS.routeStops[1]);
  gr.addColorStop(1, MAP_COLORS.routeStops[2]);
  g.strokeStyle = gr;
  g.lineWidth = 2.4;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();

  // 곡 별 (글로우) + 정거장 원
  for (const p of pts) {
    const s = e.songs.find((x) => x.musicId === p.id)!;
    const cur = p.id === currentMusicId;
    const d = cur ? 34 : 24;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = k * (s.playable ? 1 : 0.55);
    g.drawImage(spr[s.genreId % GENRE_COLORS.length], p.x - d / 2, p.y - d / 2, d, d);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = k;
    g.beginPath();
    g.arc(p.x, p.y, cur ? 6.5 : 4.6, 0, 6.284);
    g.fillStyle = MAP_COLORS.stationFill;
    g.fill();
    g.lineWidth = cur ? 2.6 : 1.8;
    g.strokeStyle = cur ? MAP_COLORS.stationCurrent : MAP_COLORS.stationStroke;
    g.stroke();
    if (e.hoverId === p.id || e.selectedId === p.id) {
      g.strokeStyle = rgba(genreRgb(s.genreId), 0.9);
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(p.x, p.y, 13, 0, 6.284);
      g.stroke();
    }
  }

  // 라벨: 순번 · 제목
  g.textAlign = "center";
  g.textBaseline = "middle";
  pts.forEach((p, i) => {
    const s = e.songs.find((x) => x.musicId === p.id)!;
    g.globalAlpha = k;
    g.font = `500 10.5px ${FONTS.body}`;
    const title = fitText(g, s.title, 120);
    const tw = g.measureText(title).width;
    g.fillStyle = MAP_COLORS.labelBg;
    roundRect(g, p.x - tw / 2 - 6, p.y + 12, tw + 12, 17, 5);
    g.fill();
    g.fillStyle = "rgba(233,241,255,.92)";
    g.fillText(title, p.x, p.y + 20.5);
    g.font = `500 8.5px ${FONTS.mono}`;
    g.fillStyle = p.id === currentMusicId ? "rgba(79,227,206,.95)" : "rgba(147,164,196,.7)";
    g.fillText(`${String(i + 1).padStart(2, "0")}${s.artist ? ` · ${s.artist}` : ""}`, p.x, p.y + 33);
  });
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
    g.drawImage(spr[s.genreId % GENRE_COLORS.length], n.x - d / 2, n.y - d / 2, d, d);
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
  g.drawImage(spr[song.genreId % GENRE_COLORS.length], tx - 22, ty - 22, 44, 44);
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

/** 내 좌표 (탑승 중에는 선미의 '나' 헬멧이 대신한다) */
function drawMe(g: CanvasRenderingContext2D, e: MapEngine) {
  if (e.follow || e.myId == null) return;
  const { px, py } = e.worldToScreen(e.me.x, e.me.y);
  const rr = 13 + Math.sin(e.time * 1.6) * 2.6;
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
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(79,227,206,.95)";
  g.font = `600 10px ${FONTS.mono}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("나", px, py + 24);
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
  drawBackground(g, e.W, e.H, e.time, e.layer / (LAYER_COUNT - 1));
  drawNebula(g, e);
  drawStars(g, e);
  drawCovers(g, e);
  drawGhostConstellation(g, e);
  drawConstellation(g, e, currentMusicId);
  drawProbe(g, e);
  drawSelected(g, e);
  drawFriends(g, e);
  drawMe(g, e);
  drawPressure(g, e);
  drawHover(g, e);
}
