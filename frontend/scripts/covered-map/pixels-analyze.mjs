/**
 * pixels.mjs 결과 분석 — 지도를 멈추면 화면이 얼마나 달라지나 (S15P21A405-737)
 *   node scripts/covered-map/pixels-analyze.mjs glass|loading|<check.mjs glass 결과 이름>
 * 멈춘 쪽에서도 바뀐 픽셀(장식 별 깜빡임·흐르는 글자 등 화면 요소)은 "지도 탓이 아님" 으로 빼고 센다.
 * 차이 = 픽셀마다 RGB 세 채널 중 가장 큰 차이(0~255). 차이 지도와 나란히 움직이는 비교(webp)도 만든다.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const DIR = process.env.OUT || path.join(os.tmpdir(), "ody-covered-map");
const MODE = process.argv[2] || "glass";
const log = JSON.parse(fs.readFileSync(path.join(DIR, `${MODE}.json`), "utf8"));
const live = log.live.filter((x) => x.file), frozen = log.frozen.filter((x) => x.file);
const load = async (f) => { const { data, info } = await sharp(path.join(DIR, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const L = []; for (const x of live) L.push(await load(x.file));
const F = []; for (const x of frozen) F.push(await load(x.file));
const W = L[0].w, H = L[0].h, N = W * H;
const dAt = (a, b, p) => { const i = p * 3; return Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); };

// 멈춘 동안에도 바뀐 픽셀 = 화면 요소의 움직임 → 제외 영역
const mask = new Uint8Array(N);
for (let k = 1; k < F.length; k++) for (let p = 0; p < N; p++) if (!mask[p] && dAt(F[k].data, F[0].data, p) >= 2) mask[p] = 1;
const maskN = mask.reduce((s, v) => s + v, 0);

const TH = [2, 4, 8, 16, 32];
function stats(a, b, useMask) {
  const cnt = TH.map(() => 0); let max = 0, sum = 0, used = 0;
  for (let p = 0; p < N; p++) {
    if (useMask && mask[p]) continue;
    used++; const d = dAt(a, b, p); if (d > max) max = d; sum += d;
    for (let k = 0; k < TH.length; k++) if (d >= TH[k]) cnt[k]++;
  }
  return { max, mean: +(sum / used).toFixed(3), pct: Object.fromEntries(TH.map((t, k) => [`>=${t}`, +((100 * cnt[k]) / used).toFixed(3)])) };
}
const liveRows = live.map((x, k) => ({ t: x.t, ...stats(L[k].data, L[0].data, true) }));
const frozenRows = frozen.map((x, k) => ({ t: x.t, ...stats(F[k].data, F[0].data, false) }));
const steps = live.slice(1).map((x, k) => ({ dt: x.t - live[k].t, ...stats(L[k + 1].data, L[k].data, true) }));

// 차이 지도: 회색 = 차이×8, 남색 = 제외 영역(화면 요소). 2×2 최댓값으로 줄여 점 하나도 안 사라지게
async function heat(a, b, file) {
  const w2 = W >> 1, h2 = H >> 1, out = Buffer.alloc(w2 * h2 * 3);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let d = 0, m = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p = (2 * y + dy) * W + 2 * x + dx; if (mask[p]) m = 1; else d = Math.max(d, dAt(a, b, p)); }
    const o = (y * w2 + x) * 3, v = Math.min(255, d * 8);
    if (m && !v) { out[o] = 10; out[o + 1] = 16; out[o + 2] = 70; } else { out[o] = v; out[o + 1] = v; out[o + 2] = v; }
  }
  await sharp(out, { raw: { width: w2, height: h2, channels: 3 } }).png().toFile(path.join(DIR, file));
}
await heat(L.at(-1).data, L[0].data, `${MODE}-heat-live.png`);

// 나란히 움직이는 비교: 왼쪽 계속 그림 · 오른쪽 멈춤, 0.5초 간격 실제 시간 순
const STEP = 500, GAP = 16;
const span = Math.min(live.at(-1).t, frozen.at(-1).t);
const pick = (arr, tau) => { let i = 0; for (let k = 0; k < arr.length; k++) if (arr[k].t <= tau) i = k; return i; };
async function sideBySide(scaleOrCrop, file) {
  const prep = async (img) => {
    let s = sharp(img.data, { raw: { width: W, height: H, channels: 3 } });
    if (scaleOrCrop.crop) s = s.extract(scaleOrCrop.crop); else s = s.resize(Math.round(W * scaleOrCrop.scale), Math.round(H * scaleOrCrop.scale));
    const { data, info } = await s.raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height };
  };
  const Lp = [], Fp = []; for (const x of L) Lp.push(await prep(x)); for (const x of F) Fp.push(await prep(x));
  const fw = Lp[0].w, fh = Lp[0].h, ow = fw * 2 + GAP;
  const taus = []; for (let tau = 0; tau <= span; tau += STEP) taus.push(tau);
  const tall = Buffer.alloc(ow * fh * taus.length * 3, 60);
  taus.forEach((tau, n) => {
    const a = Lp[pick(live, tau)].data, b = Fp[pick(frozen, tau)].data;
    for (let y = 0; y < fh; y++) {
      a.copy(tall, ((n * fh + y) * ow) * 3, y * fw * 3, (y + 1) * fw * 3);
      b.copy(tall, ((n * fh + y) * ow + fw + GAP) * 3, y * fw * 3, (y + 1) * fw * 3);
    }
  });
  await sharp(tall, { raw: { width: ow, height: fh * taus.length, channels: 3, pageHeight: fh } }).webp({ quality: 92, delay: taus.map(() => STEP), loop: 0 }).toFile(path.join(DIR, file));
  return { frames: taus.length, w: ow, h: fh, kb: Math.round(fs.statSync(path.join(DIR, file)).size / 1024) };
}
const whole = await sideBySide({ scale: 0.5 }, `${MODE}-side-half.webp`);
const crop = { left: 195, top: MODE === "glass" ? 700 : 900, width: 780, height: 780 };
const cropped = await sideBySide({ crop }, `${MODE}-side-crop.webp`);

const pickRow = (rows, t) => rows.reduce((best, r) => (Math.abs(r.t - t) < Math.abs(best.t - t) ? r : best), rows[0]);
const out = {
  mode: MODE, size: `${W}x${H}`, liveShots: live.length, frozenShots: frozen.length,
  excludedPct: +((100 * maskN) / N).toFixed(2),
  live: [600, 1000, 2000, 4000, 6000].map((t) => pickRow(liveRows, t)),
  frozenLast: frozenRows.at(-1),
  stepMedian: (() => { const s = [...steps].sort((a, b) => a.mean - b.mean); return s[Math.floor(s.length / 2)]; })(),
  stepMax: steps.reduce((m, r) => (r.max > m.max ? r : m), steps[0]),
  files: { heat: `${MODE}-heat-live.png`, whole, cropped, crop },
};
fs.writeFileSync(path.join(DIR, `${MODE}-analysis.json`), JSON.stringify({ ...out, liveRows, frozenRows, steps }, null, 1));
console.log(JSON.stringify(out, null, 1));