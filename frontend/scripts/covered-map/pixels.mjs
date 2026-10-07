/**
 * 화면 비교 캡처 — 지도를 계속 그릴 때와 멈췄을 때 화면이 얼마나 다른지 (S15P21A405-737, 코드 수정 없음)
 *   node scripts/covered-map/pixels.mjs glass [초]     폰 랭킹 탭(반투명 유리) 뒤의 지도
 *   node scripts/covered-map/pixels.mjs loading [초]   곡 목록 요청을 붙잡아 둔 로딩 화면
 *   → node scripts/covered-map/pixels-analyze.mjs glass|loading
 * 멈춤은 페이지 안에서 지도 캔버스의 그리기 함수만 빈 함수로 바꿔 흉내 낸다 — 캔버스는 마지막 그림을 그대로 들고 있다.
 * 창이 숨김이 되면 rAF 가 멈춰 "계속 그림" 도 멈춘 화면이 되므로, 장마다 보임 여부와 rAF 진행을 기록한다.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PORT = "9335";
const ORIGIN = "http://localhost:3000";
const [MODE = "glass", SECS = "6"] = process.argv.slice(2);
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

// 첫 곡 판정만 남긴 계측 (bench-baseline.mjs 와 같은 기준: 성운 스프라이트 뒤 별 스프라이트가 20개 넘게 그려진 프레임)
const INSTR = `(() => {
  const m = window.__m = { firstSongFrame: 0, firstCanvasFrame: 0 };
  const C = CanvasRenderingContext2D.prototype, oDI = C.drawImage;
  let inF = false, neb = false, stars = 0, draws = 0;
  C.drawImage = function (img, ...a) { if (inF && this.canvas.width > 500) { draws++; if (img.width === 208) neb = true; else if (neb && img.width === 48) stars++; } return oDI.call(this, img, ...a); };
  const oR = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) { return oR.call(window, (ts) => {
    inF = true; neb = false; stars = 0; draws = 0;
    try { fn(ts); } finally { inF = false; if (!m.firstCanvasFrame && draws > 0) m.firstCanvasFrame = performance.now(); if (!m.firstSongFrame && stars > 20) m.firstSongFrame = performance.now(); }
  }); };
})();`;

const FREEZE = `(() => {
  const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!cv) return null;
  const g = cv.getContext('2d');
  for (const k of ['fillRect', 'clearRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'strokeRect']) g[k] = function () {};
  return [cv.width, cv.height];
})()`;

const STATE = `(() => ({ path: location.pathname, vis: document.visibilityState,
  panel: !!document.querySelector('[data-panel-screen]'),
  loadingText: [...document.querySelectorAll('p')].some(p => p.textContent.trim() === '별을 불러오는 중'),
  canvases: [...document.querySelectorAll('canvas')].map(c => c.width + 'x' + c.height),
  firstCanvasFrame: Math.round(window.__m?.firstCanvasFrame || 0), firstSongFrame: Math.round(window.__m?.firstSongFrame || 0) }))()`;

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

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout " + ms)), ms))]);
// 창이 최소화·숨김이면 rAF 가 멈춰 "계속 그림" 도 멈춘 화면이 된다 — 창을 펴고 앞으로 가져온다
async function ensureVisible(s, targetId) {
  try { const { windowId } = await send("Browser.getWindowForTarget", { targetId }); const { bounds } = await send("Browser.getWindowBounds", { windowId });
    if (bounds.windowState === "minimized") await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } }); } catch {}
  await send("Page.bringToFront", {}, s).catch(() => {});
  await sleep(300);
  return ev(s, "document.visibilityState");
}
// 페이지 안에서 rAF 콜백 수를 센다 — 장마다 "그 사이 지도 루프가 돌았나" 를 기록하려고
const RAF_COUNTER = `(() => { if (window.__rafN != null) return; window.__rafN = 0; const f = () => { window.__rafN++; requestAnimationFrame(f); }; requestAnimationFrame(f); })()`;
async function capture(s, tag, secs, targetId) {
  await ev(s, RAF_COUNTER);
  const frames = []; const t0 = Date.now(); let lastN = await ev(s, "window.__rafN");
  while (Date.now() - t0 < secs * 1000) {
    const vis = await ev(s, "document.visibilityState");
    if (vis !== "visible") { frames.push({ t: Date.now() - t0, hidden: true, fixed: await ensureVisible(s, targetId) }); continue; }
    const t = Date.now() - t0;
    let data;
    try { ({ data } = await withTimeout(send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true }, s), 5000)); }
    catch (e) { frames.push({ t, error: e.message, fixed: await ensureVisible(s, targetId) }); continue; }
    const n = await ev(s, "window.__rafN");
    const file = path.join(OUT, `${MODE}-${tag}-${String(frames.filter((x) => x.file).length).padStart(2, "0")}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ t, done: Date.now() - t0, raf: n - lastN, file: path.basename(file) }); lastN = n;
  }
  return frames;
}

const tab = await openTab(); const s = tab.s;
const held = [];
const log = { mode: MODE, secs: Number(SECS), at: new Date().toISOString() };
try {
  if (MODE === "loading") {
    listeners.add((msg) => { if (msg.method === "Fetch.requestPaused" && msg.sessionId === s) held.push(msg.params.requestId); });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*bff/map/songs*", requestStage: "Request" }] }, s);
  }
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  if (MODE === "glass") {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) { const st = await ev(s, STATE); if (st.path === "/login") throw new Error("로그인 필요"); if (st.firstSongFrame) break; await sleep(300); }
    await sleep(4000);
    log.tab = await ev(s, `(() => { const b = document.querySelector('[data-tabbar] button[aria-label="랭킹"]'); if (!b) return 'no-tab'; b.click(); return 'ok'; })()`);
    await sleep(4000);
  } else {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) { const st = await ev(s, STATE); if (st.path === "/login") throw new Error("로그인 필요"); if (st.firstCanvasFrame && st.loadingText && held.length) break; await sleep(300); }
    await sleep(2500);
  }
  log.visibleBefore = await ensureVisible(s, tab.targetId);
  log.before = await ev(s, STATE); log.held = held.length;
  log.live = await capture(s, "live", Number(SECS), tab.targetId);
  log.frozenCanvas = await ev(s, FREEZE);
  await sleep(300);
  log.frozen = await capture(s, "frozen", Number(SECS), tab.targetId);
  log.after = await ev(s, STATE); log.heldAfter = held.length;
} catch (e) { log.error = String(e); }
finally {
  if (MODE === "loading") { for (const r of held) await send("Fetch.continueRequest", { requestId: r }, s).catch(() => {}); await send("Fetch.disable", {}, s).catch(() => {}); }
  await tab.close();
}
fs.writeFileSync(path.join(OUT, `${MODE}.json`), JSON.stringify(log, null, 1));
const sum = (a) => a ? { shots: a.filter((x) => x.file).length, hidden: a.filter((x) => x.hidden).length, errors: a.filter((x) => x.error).length, span: a.at(-1)?.done, rafPerShot: a.filter((x) => x.file).map((x) => x.raf) } : null;
console.log(JSON.stringify({ ...log, live: sum(log.live), frozen: sum(log.frozen) }));
process.exit(0);