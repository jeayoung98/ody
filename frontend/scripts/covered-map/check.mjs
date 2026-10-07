/**
 * 가려진 지도 멈춤 확인 도구 (S15P21A405-737). 화면이 비포와 같은지 보고, 코드 수정 전에는 대안을 흉내 내 견줬다.
 *
 * 흉내는 코드 수정 없이 페이지 안에서 지도 루프(map-canvas.tsx 의 rAF)의 다음 프레임 예약만 붙잡았다 놓는다.
 *   live         지금처럼 계속 그림 (실제 빌드를 그대로 잴 때도 이 모드)
 *   naive        덮인 동안 루프를 그냥 멈춤 — 돌아오면 곡 별이 0.38초 다시 밝아지고, 따라가기 중 곡이 넘어갔으면 미끄러진다
 *   shift        멈춘 시간만큼 지도 시계를 빼 줌 — 다시 밝아지기는 없어지지만 미끄러짐은 남는다
 *   engine       그리기만 쉬고 엔진은 매 프레임 (엔진은 MapCanvas 의 React props 에서 꺼낸다)
 *   engine15     그리기만 쉬고 엔진은 66ms 간격 — 실제 구현과 같은 간격
 *   engine-keep  화면 확인용: 200ms 마다 그리기 함수를 빈 함수로 바꾼 채 한 번 돌려 다시 밝아지기 장부만 살린다
 *
 *   node scripts/covered-map/check.mjs glass <탭> [play] [next]  탭 화면 유리 뒤: 계속 그림 vs 멈춤 캡처 → pixels-analyze.mjs 로 분석
 *   node scripts/covered-map/check.mjs return [회수]              지도로 돌아오는 순간: 덮인 1초 동안 그린 프레임 수, 곡 별 밝기 합
 *   node scripts/covered-map/check.mjs return-next [회수]         재생·곡 넘김 뒤 돌아오기 (LOCATE=1 이면 "내 위치로 가기" 를 켜 따라가기)
 *   node scripts/covered-map/check.mjs cost [회수] [cpu]          랭킹 탭에서 live · shift · engine · engine15 비용 번갈아
 *   node scripts/covered-map/check.mjs far-return [회수]          따라가기 중 덮인 동안 먼 곡으로 옮긴 뒤 돌아오기 — 커버·커버 그림 요청 시점
 * 환경변수: ORIGIN(기본 http://localhost:3000) · MODES(live,naive,shift …) · LOCATE · NEXT_WAIT(ms) · FAR_WAIT(ms) · TAG · OUT(결과 폴더)
 * 준비(측정용 크롬·로그인)는 scripts/README.md.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = "9335";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const [CMD = "glass", A1, A2, A3] = process.argv.slice(2);
const OUT = process.env.OUT || path.join(os.tmpdir(), "ody-covered-map");
fs.mkdirSync(OUT, { recursive: true });
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const BLOCK = ["*posthog.com*", "*google-analytics.com*", "*googletagmanager.com*"];

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const listeners = new Set();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) rej(new Error(msg.error.message)); else res(msg.result); }
  else for (const l of listeners) l(msg);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (s, expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result.value;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout " + ms)), ms))]);

/**
 * 계측 + 지도 루프 붙잡기.
 * - 지도 루프 = 큰 캔버스(폭 500 초과)에 그리는 rAF 콜백. map-canvas.tsx 는 같은 frame 함수를 매번 다시 예약하므로 함수로 알아본다
 * - pause: 그 함수의 다음 예약을 붙잡는다 (루프가 실제로 멈춘다 — 그리기·엔진 계산 모두)
 * - resume: 다시 예약한다. shift 면 멈춘 시간만큼 이후 시각을 빼서 넘긴다(엔진 시계가 이어진다)
 * - 곡 별 밝기 합: 곡 별 스프라이트(48px, 성운 208px 뒤)를 그릴 때 globalAlpha 합. 0.38초 다시 밝아지기가 걸리면 0 근처로 떨어진다
 */
const INSTR = `(() => {
  const m = window.__m = { firstSongFrame: 0, firstCanvasFrame: 0, frames: [], rec: false, starPos: [] };
  const C = CanvasRenderingContext2D.prototype, oDI = C.drawImage;
  let inF = false, neb = false, stars = 0, draws = 0, alphaSum = 0, isMap = false, pos = [], sx = 0, sy = 0, covers = 0;
  C.drawImage = function (img, ...a) {
    if (inF && this.canvas.width > 500) { isMap = true; draws++;
      if (img.width !== 48 && img.width !== 208 && a.length === 4 && a[2] >= 30 && a[2] <= 140 && Math.abs(a[2] - a[3]) < 1) covers++;
      if (img.width === 208) neb = true;
      else if (neb && img.width === 48) { stars++; alphaSum += this.globalAlpha; if (a.length === 4) { sx += a[0] + a[2] / 2; sy += a[1] + a[3] / 2; } if (a.length === 4 && this.globalAlpha > 0.5) pos.push([a[0] + a[2] / 2, a[1] + a[3] / 2, this.globalAlpha, a[2]]); } }
    return oDI.call(this, img, ...a);
  };
  const P = window.__mapPause = { paused: false, mode: 'naive', pausedAt: 0, offset: 0, held: null, mapFn: null };
  const oR = window.requestAnimationFrame.bind(window);
  const wrap = (fn) => (ts) => {
    const isMapFn = fn === P.mapFn;
    inF = true; neb = false; stars = 0; draws = 0; alphaSum = 0; isMap = false; pos = []; sx = 0; sy = 0; covers = 0;
    const t0 = performance.now();
    try { fn(isMapFn ? ts - P.offset : ts); } finally {
      inF = false;
      if (isMap) { if (!P.mapFn) P.mapFn = fn; m.starPos = pos; }
      if (!m.firstCanvasFrame && draws > 0) m.firstCanvasFrame = performance.now();
      if (!m.firstSongFrame && stars > 20) m.firstSongFrame = performance.now();
      if (m.rec && isMap) m.frames.push([Math.round(performance.now() * 10) / 10, Math.round((performance.now() - t0) * 100) / 100, draws, stars, Math.round(alphaSum * 100) / 100, stars ? Math.round((sx / stars) * 10) / 10 : null, stars ? Math.round((sy / stars) * 10) / 10 : null, covers]);
    }
  };
  window.requestAnimationFrame = function (fn) {
    if (P.paused && fn === P.mapFn) { P.held = fn; return 0; }
    return oR(wrap(fn));
  };
  // engine 계열: 그리기는 쉬고 엔진 계산만 실제 시간으로 돌린다. 엔진은 MapCanvas 의 React props 에서 꺼낸다(배포 빌드엔 __odyEngine 이 없다)
  // engine-keep: 화면 확인용 — 다시 밝아지기 장부만 살려 두려고 200ms 마다 그리기 함수를 빈 함수로 바꾼 채 지도 프레임을 한 번 돌린다
  //              (실제 구현이라면 draw-map.ts 에 몇 줄짜리 처리로 대신할 부분이라, 이 모드는 비용 측정에 쓰지 않는다)
  const findEngine = () => { const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!cv) return null; const k = Object.keys(cv).find((k) => k.startsWith('__reactFiber$')); let f = k && cv[k]; while (f) { const p = f.memoizedProps; if (p && p.engine && typeof p.engine.frame === 'function') return { engine: p.engine, cv }; f = f.return; } return null; };
  let eng = null, engOn = false, lastKeep = 0, lastEng = 0;
  const NOOP = ['fillRect', 'clearRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'strokeRect'];
  const engLoop = (ts) => {
    if (!engOn) return;
    // engine15: 엔진 계산을 초당 약 15번만 (66ms 간격)
    if (P.mode === 'engine15' && ts - lastEng < 66) { oR(engLoop); return; }
    lastEng = ts;
    try {
      if (P.mode === 'engine-keep' && P.held && ts - lastKeep >= 200) {
        lastKeep = ts; const g = eng.cv.getContext('2d'); for (const k of NOOP) g[k] = function () {};
        const f = P.held; P.held = null; try { f(ts); } finally { for (const k of NOOP) delete g[k]; if (!P.held) P.held = f; }
      } else eng.engine.frame(ts);
    } catch (e) { P.err = String(e); }
    oR(engLoop);
  };
  P.pause = (mode) => { P.mode = mode; P.paused = true; P.pausedAt = performance.now();
    if (mode.startsWith('engine')) { eng = eng || findEngine(); engOn = !!eng; lastKeep = 0; P.engineFound = !!eng; if (engOn) oR(engLoop); }
    return true; };
  P.resume = () => { if (!P.paused) return false; P.paused = false; engOn = false; if (P.mode === 'shift') P.offset += performance.now() - P.pausedAt; const f = P.held; P.held = null; if (f) oR(wrap(f)); return !!f; };
})();`;

async function openTab() {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, s); await send("Runtime.enable", {}, s); await send("Network.enable", {}, s);
  await send("Network.setBlockedURLs", { urls: BLOCK }, s);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, s);
  await send("Emulation.setUserAgentOverride", { userAgent: UA }, s);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, s);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INSTR }, s);
  await send("Page.bringToFront", {}, s);
  return { targetId, s, close: () => send("Target.closeTarget", { targetId }).catch(() => {}) };
}
async function ensureVisible(s, targetId) {
  try { const { windowId } = await send("Browser.getWindowForTarget", { targetId }); const { bounds } = await send("Browser.getWindowBounds", { windowId });
    if (bounds.windowState === "minimized") await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } }); } catch {}
  await send("Page.bringToFront", {}, s).catch(() => {});
  await sleep(300);
  return ev(s, "document.visibilityState");
}
async function loadMap(s) {
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const st = await ev(s, "({ path: location.pathname, song: window.__m && window.__m.firstSongFrame })");
    if (st?.path === "/login") throw new Error("로그인 필요");
    if (st?.song) return true;
    await sleep(300);
  }
  throw new Error("첫 곡 안 뜸");
}
async function tap(s, x, y) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }, s);
  await sleep(70);
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, s);
}
const clickTab = (s, label) => ev(s, `(() => { const b = document.querySelector('[data-tabbar] button[aria-label="${label}"]'); if (!b) return 'no-tab'; b.click(); return 'ok'; })()`);
const btnCenter = (s, re) => ev(s, `(() => { const b = [...document.querySelectorAll('button')].find(b => ${re}.test(b.getAttribute('aria-label') || '') || ${re}.test(b.textContent || '')); if (!b || b.disabled) return null; const r = b.getBoundingClientRect(); if (!r.width) return null; return [r.left + r.width / 2, r.top + r.height / 2, b.getAttribute('aria-label') || b.textContent.trim()]; })()`);

async function startPlayback(s) {
  const info = { tries: [] };
  for (let k = 0; k < 8; k++) {
    const cand = await ev(s, `(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; const r = c.getBoundingClientRect(); const W = innerWidth, H = innerHeight;
      return (window.__m.starPos || []).map(p => [p[0] + r.left, p[1] + r.top, p[2], p[3]]).filter(p => p[0] > W * 0.15 && p[0] < W * 0.85 && p[1] > H * 0.25 && p[1] < H * 0.6).sort((a, b) => b[2] * b[3] - a[2] * a[3]).slice(0, 8); })()`);
    if (!cand?.length) { await sleep(500); continue; }
    const [x, y] = cand[k % cand.length];
    await tap(s, x, y); info.tries.push([Math.round(x), Math.round(y)]);
    // 시트의 "순차 재생" 버튼은 플레이어 바 뒤에 깔려 있어 좌표 탭이 플레이어 바로 간다 — 버튼을 직접 누른다
    for (let i = 0; i < 24; i++) { const b = await btnCenter(s, "/곡 순차 재생$/"); if (b) { await ev(s, `(() => { const b = [...document.querySelectorAll('button')].find(b => /곡 순차 재생$/.test(b.getAttribute('aria-label') || '') || /곡 순차 재생$/.test(b.textContent || '')); b && b.click(); })()`); info.button = b[2]; break; } await sleep(250); }
    if (info.button) break;
  }
  for (let i = 0; i < 40; i++) {
    const idle = await ev(s, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('재생할 곡을 고르세요'))`);
    if (!idle) { info.playing = true; break; }
    await sleep(250);
  }
  info.title = await ev(s, `(() => { const t = [...document.querySelectorAll('button')].find(b => b.querySelector('p')); return t ? t.textContent.trim().slice(0, 80) : null; })()`);
  return info;
}

async function capture(s, name, tag, secs, targetId, onTick) {
  const frames = []; const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < secs * 1000) {
    if (onTick) await onTick(Date.now() - t0);
    const vis = await ev(s, "document.visibilityState");
    if (vis !== "visible") { frames.push({ t: Date.now() - t0, hidden: true, fixed: await ensureVisible(s, targetId) }); continue; }
    const t = Date.now() - t0;
    let data;
    try { ({ data } = await withTimeout(send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true }, s), 5000)); }
    catch (e) { frames.push({ t, error: e.message, fixed: await ensureVisible(s, targetId) }); continue; }
    const file = `${name}-${tag}-${String(n++).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(data, "base64"));
    frames.push({ t, done: Date.now() - t0, file });
  }
  return frames;
}

const SLUG = { "랭킹": "chart", "주변 사람": "friends", "마이페이지": "me" };
async function glass(tabLabel = "랭킹", play = false, next = false) {
  const name = `g-${SLUG[tabLabel] || "x"}${play ? "-play" : ""}${next ? "-next" : ""}`;
  const tab = await openTab(); const s = tab.s; const log = { name, tab: tabLabel, play, next, at: new Date().toISOString() };
  try {
    await loadMap(s); await sleep(3000);
    if (play) { log.playback = await startPlayback(s); await sleep(2500); }
    log.tabClick = await clickTab(s, tabLabel); await sleep(3000);
    log.visible = await ensureVisible(s, tab.targetId);
    const pressNext = () => { let done = false; return async (t) => { if (!next || done || t < 2000) return; const ok = await ev(s, `(() => { const b = document.querySelector('button[aria-label="다음"]'); if (!b || b.disabled) return false; b.click(); return true; })()`); if (ok) done = true; }; };
    const barTitle = () => ev(s, `(() => { const t = [...document.querySelectorAll('button')].find(b => b.querySelector('p')); return t ? t.textContent.trim().slice(0, 80) : null; })()`);
    log.barBefore = await barTitle();
    log.live = await capture(s, name, "live", 6, tab.targetId, pressNext());
    log.barAfterLive = await barTitle();
    log.paused = await ev(s, "window.__mapPause.pause('naive')"); await sleep(400);
    log.frozen = await capture(s, name, "frozen", 6, tab.targetId, pressNext());
    log.barAfterFrozen = await barTitle();
    log.mapFn = await ev(s, "!!window.__mapPause.mapFn");
  } catch (e) { log.error = String(e); }
  finally { await tab.close(); }
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(log, null, 1));
  const sum = (a) => a ? { shots: a.filter((x) => x.file).length, hidden: a.filter((x) => x.hidden).length, errors: a.filter((x) => x.error).length } : null;
  console.log(JSON.stringify({ ...log, live: sum(log.live), frozen: sum(log.frozen) }));
}

const RETURN_EXPR = `(async () => {
  const m = window.__m, P = window.__mapPause;
  m.frames = []; m.rec = true;
  const b = document.querySelector('[data-tabbar] button[aria-label="지도"]');
  const tClick = performance.now(); b.click();
  while (document.querySelector('[data-panel-screen]')) await new Promise((r) => setTimeout(r, 2));
  const tGone = performance.now(), wallGone = Date.now();
  const resumed = P.resume();
  return { tClick, tGone, wallGone, resumed, offset: Math.round(P.offset) };
})()`;
async function returnTest(rounds = 2) {
  const all = [];
  for (let r = 0; r < rounds; r++) for (const mode of (process.env.MODES || "live,naive,shift").split(",")) {
    const tab = await openTab(); const s = tab.s; const res = { mode, round: r };
    try {
      await loadMap(s); await sleep(4000);
      await ev(s, "window.__m.frames = []; window.__m.rec = true"); await sleep(800);
      const base = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      res.baseAlpha = base.map((f) => f[4]).sort((a, b) => a - b)[Math.floor(base.length / 2)];
      res.tabClick = await clickTab(s, "랭킹"); await sleep(1000);
      if (mode !== "live") res.paused = await ev(s, `window.__mapPause.pause('${mode}')`);
      await sleep(3000);
      await ev(s, "window.__m.frames = []; window.__m.rec = true"); await sleep(1000);
      res.mapFramesWhileCovered = (await ev(s, "(window.__m.rec = false, window.__m.frames)")).length;
      res.visible = await ensureVisible(s, tab.targetId);
      const shots = [];
      const onFrame = (msg) => { if (msg.method === "Page.screencastFrame" && msg.sessionId === s) { shots.push({ ts: msg.params.metadata.timestamp, data: msg.params.data }); send("Page.screencastFrameAck", { sessionId: msg.params.sessionId }, s).catch(() => {}); } };
      listeners.add(onFrame);
      await send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 }, s);
      await sleep(400);
      const ret = await ev(s, RETURN_EXPR);
      await sleep(1500);
      await send("Page.stopScreencast", {}, s); listeners.delete(onFrame);
      const frames = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      res.ret = { resumed: ret.resumed, offset: ret.offset, gone: Math.round(ret.tGone - ret.tClick) };
      res.after = frames.filter((f) => f[0] >= ret.tGone).map((f) => [Math.round(f[0] - ret.tGone), +(f[4] / res.baseAlpha).toFixed(3), f[3]]);
      const toMs = (ts) => (ts < 1e11 ? ts * 1000 : ts);
      res.shots = shots.map((x, k) => { const file = `ret-${mode}-${r}-${String(k).padStart(3, "0")}.jpg`; fs.writeFileSync(path.join(OUT, file), Buffer.from(x.data, "base64")); return [Math.round(toMs(x.ts) - ret.wallGone), file]; });
    } catch (e) { res.error = String(e); }
    finally { await tab.close(); }
    all.push(res);
    const a = res.after || [];
    const at = (ms) => { const f = a.find((x) => x[0] >= ms); return f ? f[1] : null; };
    console.log(JSON.stringify({ mode, round: r, err: res.error, framesWhileCovered: res.mapFramesWhileCovered, baseAlpha: res.baseAlpha, gone: res.ret?.gone, ratio: { "0": at(0), "100": at(100), "200": at(200), "300": at(300), "400": at(400), "600": at(600), "1000": at(1000) }, minRatio: a.length ? Math.min(...a.map((x) => x[1])) : null, shots: res.shots?.length }));
  }
  fs.writeFileSync(path.join(OUT, "return.json"), JSON.stringify(all, null, 1));
}

async function playDebug() {
  const tab = await openTab(); const s = tab.s; const out = {};
  try {
    await loadMap(s); await sleep(3000);
    const cand = await ev(s, `(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; const r = c.getBoundingClientRect(); const W = innerWidth, H = innerHeight;
      return (window.__m.starPos || []).map(p => [p[0] + r.left, p[1] + r.top, p[2], p[3]]).filter(p => p[0] > W * 0.15 && p[0] < W * 0.85 && p[1] > H * 0.25 && p[1] < H * 0.6).sort((a, b) => b[2] * b[3] - a[2] * a[3]).slice(0, 5); })()`);
    out.cand = cand?.map((p) => p.map((v) => Math.round(v * 100) / 100));
    await tap(s, cand[0][0], cand[0][1]); await sleep(2500);
    out.sheet = await ev(s, `(() => { const el = document.querySelector('[data-sheet]'); return el ? { snap: el.getAttribute('data-snap'), rect: el.getBoundingClientRect().toJSON() } : null; })()`);
    const b = await btnCenter(s, "/곡 순차 재생$/");
    out.button = b;
    if (b) {
      out.atPoint = await ev(s, `(() => { const e = document.elementFromPoint(${b[0]}, ${b[1]}); const chain = []; for (let x = e; x && chain.length < 6; x = x.parentElement) chain.push(x.tagName.toLowerCase() + (x.getAttribute('aria-label') ? '[' + x.getAttribute('aria-label') + ']' : '') + (x.hasAttribute('data-sheet') ? '[data-sheet]' : '') + (x.hasAttribute('data-tabbar') ? '[tabbar]' : '')); return chain; })()`);
      await tap(s, b[0], b[1]); await sleep(2500);
      out.idleAfterTap = await ev(s, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('재생할 곡을 고르세요'))`);
      if (out.idleAfterTap) {
        out.clickResult = await ev(s, `(() => { const b = [...document.querySelectorAll('button')].find(b => /곡 순차 재생$/.test(b.getAttribute('aria-label') || '') || /곡 순차 재생$/.test(b.textContent || '')); if (!b) return 'no-button'; b.click(); return 'clicked'; })()`);
        await sleep(2500);
        out.idleAfterClick = await ev(s, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('재생할 곡을 고르세요'))`);
      }
      out.toast = await ev(s, `[...document.querySelectorAll('[role=status],[role=alert]')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 3)`);
      out.bar = await ev(s, `(() => { const t = [...document.querySelectorAll('button')].find(b => b.querySelector('p')); return t ? t.textContent.trim().slice(0, 80) : null; })()`);
    }
    const { data } = await send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true }, s);
    fs.writeFileSync(path.join(OUT, "play-debug.png"), Buffer.from(data, "base64"));
  } catch (e) { out.error = String(e); }
  finally { await tab.close(); }
  console.log(JSON.stringify(out));
}

async function returnNext(rounds = 1) {
  const all = [];
  for (let r = 0; r < rounds; r++) for (const mode of (process.env.MODES || "live,naive,shift").split(",")) {
    const tab = await openTab(); const s = tab.s; const res = { mode, round: r };
    try {
      await loadMap(s); await sleep(3000);
      res.playback = await startPlayback(s); await sleep(2500);
      // "내 위치로 가기" 를 누르면 별 고정이 풀리고 재생 곡을 따라간다 (map-engine centerOn: centerHoldId = null)
      if (process.env.LOCATE) { res.locate = await ev(s, `(() => { const b = document.querySelector('button[aria-label="내 위치로 가기"]'); if (!b) return false; b.click(); return true; })()`); await sleep(2500); }
      await ev(s, "window.__m.frames = []; window.__m.rec = true"); await sleep(600);
      const base = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      res.baseAlpha = base.map((f) => f[4]).sort((a, b) => a - b)[Math.floor(base.length / 2)];
      res.tabClick = await clickTab(s, "랭킹"); await sleep(1000);
      if (mode !== "live") res.paused = await ev(s, `window.__mapPause.pause('${mode}')`);
      await sleep(500);
      res.next = await ev(s, `(() => { const b = document.querySelector('button[aria-label="다음"]'); if (!b || b.disabled) return false; b.click(); return true; })()`);
      await sleep(Number(process.env.NEXT_WAIT || 3000));
      res.bar = await ev(s, `(() => { const t = [...document.querySelectorAll('button')].find(b => b.querySelector('p')); return t ? t.textContent.trim().slice(0, 80) : null; })()`);
      res.visible = await ensureVisible(s, tab.targetId);
      const shots = [];
      const onFrame = (msg) => { if (msg.method === "Page.screencastFrame" && msg.sessionId === s) { shots.push({ ts: msg.params.metadata.timestamp, data: msg.params.data }); send("Page.screencastFrameAck", { sessionId: msg.params.sessionId }, s).catch(() => {}); } };
      listeners.add(onFrame);
      await send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 }, s);
      await sleep(400);
      const ret = await ev(s, RETURN_EXPR);
      await sleep(2500);
      await send("Page.stopScreencast", {}, s); listeners.delete(onFrame);
      const toMs = (ts) => (ts < 1e11 ? ts * 1000 : ts);
      res.shots = shots.map((x, k) => { const file = `rn-${process.env.TAG || ""}${mode}-${r}-${String(k).padStart(3, "0")}.jpg`; fs.writeFileSync(path.join(OUT, file), Buffer.from(x.data, "base64")); return [Math.round(toMs(x.ts) - ret.wallGone), file]; });
      const frames = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      const after = frames.filter((f) => f[0] >= ret.tGone && f[3] > 20);
      res.after = after.map((f) => [Math.round(f[0] - ret.tGone), +(f[4] / res.baseAlpha).toFixed(2), f[5], f[6]]);
      // 돌아온 뒤 곡 별 위치 평균이 얼마나 움직였나 (첫 프레임 → 2초 뒤), 그리고 언제 멎었나
      if (after.length > 2) {
        const first = after[0], last = after.at(-1);
        res.move = Math.round(Math.hypot(last[5] - first[5], last[6] - first[6]));
        let settle = 0; for (let k = 1; k < after.length; k++) if (Math.hypot(after[k][5] - after[k - 1][5], after[k][6] - after[k - 1][6]) > 0.5) settle = Math.round(after[k][0] - ret.tGone);
        res.settleMs = settle;
      }
    } catch (e) { res.error = String(e); }
    finally { await tab.close(); }
    all.push(res);
    console.log(JSON.stringify({ mode, round: r, err: res.error, playing: res.playback?.playing, locate: res.locate, next: res.next, bar: res.bar, move: res.move, settleMs: res.settleMs, firstRatio: res.after?.[0]?.[1], n: res.after?.length }));
  }
  fs.writeFileSync(path.join(OUT, process.env.LOCATE ? "return-next-locate.json" : "return-next.json"), JSON.stringify(all, null, 1));
}

async function costBench(rounds = 3, cpu = 4) {
  const tab = await openTab(); const s = tab.s; const out = { cpu, live: [], shift: [], engine: [], engine15: [] };
  try {
    await send("Performance.enable", {}, s);
    await send("Emulation.setCPUThrottlingRate", { rate: cpu }, s);
    await loadMap(s); await sleep(5000);
    out.tab = await clickTab(s, "랭킹"); await sleep(3000);
    await ev(s, "window.__m.frames = []");
    const RAFQ = `(() => { if (window.__pfOn) return; window.__pfOn = true; window.__pf = []; let last = 0; const o = window.requestAnimationFrame; const f = (ts) => { if (window.__pfRec) { if (last) window.__pf.push(ts - last); last = ts; } else last = 0; o(f); }; o(f); })()`;
    await ev(s, RAFQ);
    const metrics = async () => Object.fromEntries((await send("Performance.getMetrics", {}, s)).metrics.map((x) => [x.name, x.value]));
    const order = ["live", "shift", "engine", "engine15"];
    for (let i = 0; i < rounds; i++) {
      for (const cond of i % 2 ? [...order].reverse() : order) {
        await ev(s, "window.__mapPause.resume()");
        if (cond !== "live") await ev(s, `window.__mapPause.pause('${cond}')`);
        await sleep(1500);
        await ev(s, "window.__pf = []; window.__pfRec = true; window.__m.frames = []; window.__m.rec = true");
        const m0 = await metrics(); const t0 = Date.now(); await sleep(8000); const m1 = await metrics(); const wall = (Date.now() - t0) / 1000;
        const pf = await ev(s, "(window.__pfRec = false, window.__pf)"); const mf = await ev(s, "(window.__m.rec = false, window.__m.frames.length)");
        const sorted = [...pf].sort((a, b) => a - b);
        out[cond].push({ task: Math.round(((m1.TaskDuration - m0.TaskDuration) / wall) * 1000), script: Math.round(((m1.ScriptDuration - m0.ScriptDuration) / wall) * 1000), pageFps: Math.round((pf.length / wall) * 10) / 10, gapP90: sorted.length ? Math.round(sorted[Math.floor(sorted.length * 0.9)] * 10) / 10 : null, mapFps: Math.round((mf / wall) * 10) / 10, engineFound: await ev(s, "window.__mapPause.engineFound ?? null"), err: await ev(s, "window.__mapPause.err ?? null") });
      }
    }
    await ev(s, "window.__mapPause.resume()");
  } catch (e) { out.error = String(e); }
  finally { await tab.close(); }
  const med = (a, k) => { const v = a.map((x) => x[k]).filter((x) => x != null).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
  const sum = Object.fromEntries(["live", "shift", "engine", "engine15"].map((k) => [k, { task: med(out[k], "task"), script: med(out[k], "script"), pageFps: med(out[k], "pageFps"), gapP90: med(out[k], "gapP90"), mapFps: med(out[k], "mapFps") }]));
  console.log(JSON.stringify({ cpu, error: out.error, engineFound: out.engine[0]?.engineFound, err: out.engine.find((x) => x.err)?.err, summary: sum }));
}

// 덮인 동안 지도가 멀리 옮겨 간 뒤 돌아올 때 — 표지가 늦게 채워지나 (S15P21A405-737 구현 확인용)
// 따라가기("내 위치로 가기") 상태에서 탭에 간 뒤, 엔진의 재생 곡을 같은 겹의 가장 먼 곡으로 바꿔 지도가 그쪽으로 옮겨 가게 한다
const FAR_EXPR = `(() => {
  const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const k = Object.keys(cv).find((k) => k.startsWith('__reactFiber$')); let f = cv[k], engine = null;
  while (f) { const p = f.memoizedProps; if (p && p.engine && typeof p.engine.frame === 'function') { engine = p.engine; break; } f = f.return; }
  if (!engine) return { err: 'no-engine' };
  const from = engine.playingId != null ? engine.worldOf(engine.playingId) : { x: engine.cam.cx, y: engine.cam.cy };
  let best = null, bestD = -1;
  for (let i = 0; i < engine.N; i++) { if (!engine.subset[i]) continue; const id = engine.songs[i].musicId; const w = engine.worldOf(id); if (!w) continue; const d = (w.x - from.x) ** 2 + (w.y - from.y) ** 2; if (d > bestD) { bestD = d; best = id; } }
  const cam0 = { ...engine.cam };
  engine.playingId = best;
  return { from, to: engine.worldOf(best), farId: best, cam0, centerLock: engine.centerLock, holdId: engine.centerHoldId };
})()`;
async function farReturn(rounds = 1) {
  const all = [];
  for (let r = 0; r < rounds; r++) {
    const tab = await openTab(); const s = tab.s; const res = { round: r, origin: ORIGIN };
    try {
      await loadMap(s); await sleep(3000);
      res.playback = await startPlayback(s); await sleep(2500);
      res.locate = await ev(s, `(() => { const b = document.querySelector('button[aria-label="내 위치로 가기"]'); if (!b) return false; b.click(); return true; })()`); await sleep(2500);
      await ev(s, "window.__m.frames = []; window.__m.rec = true"); await sleep(800);
      const base = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      res.baseCovers = base.map((x) => x[7]).sort((a, b) => a - b)[Math.floor(base.length / 2)];
      res.tabClick = await clickTab(s, "랭킹"); await sleep(1000);
      // 앨범 그림 요청 기록 (Cover Art Archive) — 먼 곳으로 옮긴 뒤 언제 받기 시작하나
      const coverReq = []; const onReq = (msg) => { if (msg.sessionId === s && msg.method === "Network.requestWillBeSent" && /coverartarchive|archive\.org/.test(msg.params.request.url)) coverReq.push(Math.round(msg.params.wallTime * 1000)); };
      listeners.add(onReq);
      const farAt = Date.now();
      res.far = await ev(s, FAR_EXPR);
      await sleep(Number(process.env.FAR_WAIT || 5000));
      res.camAfterCover = await ev(s, `(() => { const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; const k = Object.keys(cv).find((k) => k.startsWith('__reactFiber$')); let f = cv[k]; while (f) { const p = f.memoizedProps; if (p && p.engine) return { ...p.engine.cam }; f = f.return; } return null; })()`);
      res.visible = await ensureVisible(s, tab.targetId);
      const shots = [];
      const onFrame = (msg) => { if (msg.method === "Page.screencastFrame" && msg.sessionId === s) { shots.push({ ts: msg.params.metadata.timestamp, data: msg.params.data }); send("Page.screencastFrameAck", { sessionId: msg.params.sessionId }, s).catch(() => {}); } };
      listeners.add(onFrame);
      await send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 }, s);
      await sleep(400);
      const ret = await ev(s, RETURN_EXPR);
      await sleep(2000);
      await send("Page.stopScreencast", {}, s); listeners.delete(onFrame);
      listeners.delete(onReq);
      res.coverReq = { duringCover: coverReq.filter((t) => t >= farAt && t < ret.wallGone).length, afterReturn: coverReq.filter((t) => t >= ret.wallGone).length };
      const frames = await ev(s, "(window.__m.rec = false, window.__m.frames)");
      const after = frames.filter((x) => x[0] >= ret.tGone);
      res.after = after.map((x) => [Math.round(x[0] - ret.tGone), x[7], x[3], x[5], x[6]]);
      const toMs = (ts) => (ts < 1e11 ? ts * 1000 : ts);
      res.shots = shots.map((x, k) => { const file = `far-${process.env.TAG || ""}${r}-${String(k).padStart(3, "0")}.jpg`; fs.writeFileSync(path.join(OUT, file), Buffer.from(x.data, "base64")); return [Math.round(toMs(x.ts) - ret.wallGone), file]; });
    } catch (e) { res.error = String(e); }
    finally { await tab.close(); }
    all.push(res);
    const a = res.after || [];
    const firstFull = a.find((x) => x[1] >= (res.baseCovers || 0));
    console.log(JSON.stringify({ round: r, origin: ORIGIN, err: res.error, coverReq: res.coverReq, playing: res.playback?.playing, locate: res.locate, far: res.far && { farId: res.far.farId, centerLock: res.far.centerLock, holdId: res.far.holdId, err: res.far.err }, camMoved: res.far && res.camAfterCover ? Math.round(Math.hypot(res.camAfterCover.cx - res.far.cam0.cx, res.camAfterCover.cy - res.far.cam0.cy) * res.camAfterCover.s) : null,
      baseCovers: res.baseCovers, coversFirstFrames: a.slice(0, 12).map((x) => x[1]), coversAt: Object.fromEntries([0, 100, 200, 400, 800, 1500].map((t) => [t, (a.find((x) => x[0] >= t) || [])[1] ?? null])), firstFullMs: firstFull ? firstFull[0] : null, moveAfterReturn: a.length > 2 ? Math.round(Math.hypot(a.at(-1)[3] - a[0][3], a.at(-1)[4] - a[0][4])) : null }));
  }
  fs.writeFileSync(path.join(OUT, `far-return-${process.env.TAG || "x"}.json`), JSON.stringify(all, null, 1));
}

if (CMD === "glass") await glass(A1 || "랭킹", A2 === "play" || A3 === "play", A2 === "next" || A3 === "next");
else if (CMD === "return") await returnTest(Number(A1 || 2));
else if (CMD === "playdebug") await playDebug();
else if (CMD === "return-next") await returnNext(Number(A1 || 1));
else if (CMD === "cost") await costBench(Number(A1 || 3), Number(A2 || 4));
else if (CMD === "far-return") await farReturn(Number(A1 || 1));
process.exit(0);