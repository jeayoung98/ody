/**
 * 로딩 중 지도 그리기를 줄이면 첫 곡이 빨라지나 (S15P21A405-737 조사 — 결론: 첫 방문은 오히려 +0.96초, 그래서 안 함)
 *   node scripts/covered-map/loading-hold.mjs load [rounds=3]       폰 CPU×4·LTE 첫 방문: 지금 vs 곡 목록이 올 때까지 지도 루프 붙잡기, 번갈아
 *   node scripts/covered-map/loading-hold.mjs loadwarm [rounds=3]   같은 비교, 재방문(캐시 있음)
 *   node scripts/covered-map/loading-hold.mjs netlog [rounds=1]     브라우저 네트워크 기록(아이프레임 포함)으로 곡 목록과 겹쳐 받은 것
 *   node scripts/covered-map/loading-hold.mjs cover [rounds] [cpu]  랭킹 탭에서 지금 vs 멈춤(시계 보정) — 첫 흉내 (check.mjs cost 로 대체)
 * 메인 스레드가 비면 유튜브 플레이어(약 750KB)와 커버 그림이 곡 목록 다운로드와 겹쳐 망을 나눠 쓴다 — netlog 로 확인.
 * 조건·첫 곡 판정은 baseline-bench.mjs 와 같다(PostHog·GA 차단, 별 스프라이트 20개 넘게 그린 첫 프레임).
 */

const PORT = process.env.CDP_PORT || "9335";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const STAR_MIN = 20;
const BLOCK = ["*posthog.com*", "*google-analytics.com*", "*googletagmanager.com*"];
const [MODE = "load", N = "3", CPU = "4"] = process.argv.slice(2);
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const PHONE = { label: "폰 390x844 DPR3 · CPU×4 · LTE 10Mbps/60ms", cpu: 4, net: { latency: 60, down: 10e6 / 8, up: 5e6 / 8 }, w: 390, h: 844, dpr: 3, mobile: true };

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
const q = (a, p) => { const s = [...a].filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const ev = async (s, expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result.value;

const mkInstr = (hold) => `(() => {
  const HOLD = ${hold ? "true" : "false"};
  const m = window.__m = { firstSongFrame: 0, firstCanvasFrame: 0, songsAt: 0, lt: [], vis: [], frames: [], pf: [], rec: false, layer1Songs: null, heldFrames: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => m.lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  document.addEventListener('visibilitychange', () => m.vis.push([Math.round(performance.now()), document.visibilityState]));
  const P = window.__mapPause = { paused: false, mode: 'shift', pausedAt: 0, offset: 0, held: null, mapFn: null };
  const oR = window.requestAnimationFrame.bind(window);
  const C = CanvasRenderingContext2D.prototype, oDI = C.drawImage;
  let inF = false, neb = false, stars = 0, draws = 0, isMap = false;
  C.drawImage = function (img, ...a) { if (inF && this.canvas.width > 500) { isMap = true; draws++; if (img.width === 208) neb = true; else if (neb && img.width === 48) stars++; } return oDI.call(this, img, ...a); };
  const wrap = (fn) => (ts) => {
    const isMapFn = fn === P.mapFn;
    inF = true; neb = false; stars = 0; draws = 0; isMap = false;
    const t0 = performance.now();
    try { fn(isMapFn ? ts - P.offset : ts); } finally {
      inF = false;
      if (isMap && !P.mapFn) P.mapFn = fn;
      if (!m.firstCanvasFrame && draws > 0) m.firstCanvasFrame = performance.now();
      if (!m.firstSongFrame && stars > ${STAR_MIN}) { m.firstSongFrame = performance.now(); try { performance.mark('ody-first-song'); } catch (e) {} }
      if (m.rec && isMap) m.frames.push(Math.round((performance.now() - t0) * 100) / 100);
    }
  };
  window.requestAnimationFrame = function (fn) {
    if ((P.paused || (HOLD && !m.songsAt)) && fn === P.mapFn) { P.held = fn; m.heldFrames++; return 0; }
    return oR(wrap(fn));
  };
  let lastPF = 0;
  const pfLoop = (ts) => { if (m.rec) { if (lastPF) m.pf.push(Math.round((ts - lastPF) * 10) / 10); lastPF = ts; } else lastPF = 0; oR(pfLoop); };
  oR(pfLoop);
  const oj = Response.prototype.json;
  Response.prototype.json = async function () { const u = this.url; const v = await oj.call(this);
    try { if (/bff\\/map\\/songs/.test(u) && /level=1/.test(u) && !m.songsAt) { m.songsAt = performance.now(); const d = v && v.data; m.layer1Songs = Array.isArray(d) ? d.length : (d && Array.isArray(d.songs) ? d.songs.length : null);
      if (HOLD && !P.paused) { const f = P.held; P.held = null; if (f) oR(wrap(f)); } } } catch (e) {}
    return v; };
  P.pause = (mode) => { if (P.paused) return true; P.mode = mode; P.paused = true; P.pausedAt = performance.now(); return true; };
  P.resume = () => { if (!P.paused) return false; P.paused = false; if (P.mode === 'shift') P.offset += performance.now() - P.pausedAt; const f = P.held; P.held = null; if (f) oR(wrap(f)); return !!f; };
  m.start = () => { m.frames = []; m.pf = []; m.rec = true; };
  m.stop = () => { m.rec = false; const r = { frames: m.frames, pf: m.pf }; m.frames = []; m.pf = []; return r; };
})();`;

async function applyConditions(p, s) {
  await send("Network.enable", {}, s);
  await send("Network.setBlockedURLs", { urls: BLOCK }, s);
  await send("Emulation.setCPUThrottlingRate", { rate: p.cpu }, s);
  await send("Network.emulateNetworkConditions", p.net ? { offline: false, latency: p.net.latency, downloadThroughput: p.net.down, uploadThroughput: p.net.up } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, s);
}
async function openTab(p, instr) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const onAttach = async (msg) => {
    if (msg.method === "Target.attachedToTarget" && msg.sessionId === s && msg.params.waitingForDebugger) {
      const cs = msg.params.sessionId; try { await applyConditions(p, cs); } catch {} send("Runtime.runIfWaitingForDebugger", {}, cs).catch(() => {});
    }
  };
  listeners.add(onAttach);
  await send("Page.enable", {}, s); await send("Runtime.enable", {}, s); await send("Performance.enable", {}, s);
  await applyConditions(p, s);
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, s);
  await send("Emulation.setDeviceMetricsOverride", { width: p.w, height: p.h, deviceScaleFactor: p.dpr, mobile: p.mobile }, s);
  await send("Emulation.setUserAgentOverride", { userAgent: UA }, s);
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, s);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: instr }, s);
  await send("Page.bringToFront", {}, s);
  return { targetId, s, close: async () => { listeners.delete(onAttach); await send("Target.closeTarget", { targetId }).catch(() => {}); } };
}
const metricsOf = (r) => Object.fromEntries(r.metrics.map((x) => [x.name, x.value]));
const clickTab = (s, label) => ev(s, `(() => { const b = document.querySelector('[data-tabbar] button[aria-label="${label}"]'); if (!b) return 'no-tab'; b.click(); return 'ok'; })()`);

async function measureWindow(s, secs) {
  const tStart = await ev(s, "(window.__m.start(), performance.now())");
  const m0 = metricsOf(await send("Performance.getMetrics", {}, s)); const t0 = Date.now();
  await sleep(secs * 1000);
  const m1 = metricsOf(await send("Performance.getMetrics", {}, s)); const wall = (Date.now() - t0) / 1000;
  const { frames, pf } = await ev(s, "window.__m.stop()");
  const tEnd = await ev(s, "performance.now()");
  const lt = await ev(s, `window.__m.lt.filter(([t]) => t >= ${tStart} && t <= ${tEnd})`);
  const vis = await ev(s, "document.visibilityState");
  return { vis, mapFps: r1(frames.length / wall), mapFrameMsMed: r1(q(frames, 0.5)), pageFps: r1(pf.length / wall), pageGapP50: r1(q(pf, 0.5)), pageGapP90: r1(q(pf, 0.9)), pageGapMax: r1(q(pf, 1)),
    taskMsPerSec: r1(((m1.TaskDuration - m0.TaskDuration) / wall) * 1000), scriptMsPerSec: r1(((m1.ScriptDuration - m0.ScriptDuration) / wall) * 1000),
    longTasks: lt.length, longTaskMsPerSec: r1(lt.reduce((a, [, d]) => a + d, 0) / wall) };
}

async function coverBench(rounds, cpu) {
  const p = { ...PHONE, cpu, net: null, label: `폰 390x844 DPR3 · CPU×${cpu} · 망 감속 없음` };
  const tab = await openTab(p, mkInstr(false)); const s = tab.s;
  const out = { cond: p.label, live: [], paused: [] };
  try {
    await send("Page.navigate", { url: ORIGIN + "/" }, s);
    const t0 = Date.now(); while (Date.now() - t0 < 90000) { const v = await ev(s, "window.__m && window.__m.firstSongFrame"); if (v) break; await sleep(300); }
    await sleep(5000);
    out.tab = await clickTab(s, "랭킹"); await sleep(3000);
    out.panel = await ev(s, "!!document.querySelector('[data-panel-screen]')");
    for (let i = 0; i < rounds; i++) {
      for (const cond of i % 2 ? ["paused", "live"] : ["live", "paused"]) {
        if (cond === "paused") await ev(s, "window.__mapPause.pause('shift')"); else await ev(s, "window.__mapPause.resume()");
        await sleep(1500);
        out[cond].push(await measureWindow(s, 8));
      }
    }
    await ev(s, "window.__mapPause.resume()");
    out.vis = await ev(s, "window.__m.vis");
  } finally { await tab.close(); }
  const sum = (a) => Object.fromEntries(["mapFps", "pageFps", "pageGapP50", "pageGapP90", "pageGapMax", "taskMsPerSec", "scriptMsPerSec", "longTasks", "longTaskMsPerSec"].map((k) => [k, q(a.map((x) => x[k]), 0.5)]));
  console.log(JSON.stringify({ ...out, summary: { live: sum(out.live), paused: sum(out.paused) } }, null, 1));
}

async function timedLoad(hold, clear = true) {
  const tab = await openTab(PHONE, mkInstr(hold)); const s = tab.s;
  try {
    if (clear) await send("Network.clearBrowserCache", {}, s);
    await send("Page.navigate", { url: ORIGIN + "/" }, s);
    const t0 = Date.now(); let ready = null;
    while (Date.now() - t0 < 120000) { ready = await ev(s, "window.__m && window.__m.firstSongFrame"); if (ready) break; await sleep(150); }
    await sleep(1000);
    return await ev(s, `(() => { const m = window.__m; const ready = ${ready || 0};
      const lt = m.lt.filter(([t]) => !ready || t <= ready);
      return { hold: ${hold}, ready: Math.round(ready), firstCanvas: Math.round(m.firstCanvasFrame), songsAt: Math.round(m.songsAt), heldFrames: m.heldFrames, layer1Songs: m.layer1Songs,
        longTasks: lt.length, longTaskMs: lt.reduce((a, [, d]) => a + d, 0), tbt: lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0),
        hidden: m.vis.some(([t, v]) => v === 'hidden' && (!ready || t <= ready)), path: location.pathname, overlap: (() => { const R = performance.getEntriesByType('resource'); const sr = R.filter(r => r.name.includes('bff/map/songs') && r.transferSize > 100000)[0]; if (!sr) return null; return R.filter(r => r !== sr && r.startTime < sr.responseEnd && r.responseEnd > sr.requestStart && (r.transferSize || 0) > 15000).map(r => [r.name.split('?')[0].split('/').slice(2).join('/').slice(-60), Math.round(r.startTime), Math.round(r.responseEnd), Math.round((r.transferSize || 0) / 1024)]); })(), songsRes: performance.getEntriesByType('resource').filter(r => r.name.includes('bff/map/songs')).map(r => [r.name.split('?')[1], Math.round(r.startTime), Math.round(r.responseStart), Math.round(r.responseEnd), Math.round((r.transferSize || 0) / 1024)]) }; })()`);
  } finally { await tab.close(); }
}
async function loadBench(rounds, warm = false) {
  const live = [], hold = [];
  if (warm) await timedLoad(false, true); // 캐시 채우기(세지 않음)
  for (let i = 0; i < rounds; i++) {
    for (const h of i % 2 ? [true, false] : [false, true]) { const r = await timedLoad(h, !warm); (h ? hold : live).push(r); }
  }
  const sum = (a) => { const ok = a.filter((x) => x && x.ready && !x.hidden); return { runs: a.length, valid: ok.length, readyMed: q(ok.map((x) => x.ready), 0.5), songsAtMed: q(ok.map((x) => x.songsAt), 0.5), firstCanvasMed: q(ok.map((x) => x.firstCanvas), 0.5), windowMed: q(ok.map((x) => x.ready - x.firstCanvas), 0.5), tbtMed: q(ok.map((x) => x.tbt), 0.5), longTaskMsMed: q(ok.map((x) => x.longTaskMs), 0.5), heldFramesMed: q(ok.map((x) => x.heldFrames), 0.5) }; };
  console.log(JSON.stringify({ cond: PHONE.label + (warm ? " · 재방문" : " · 첫 방문"), live: { ...sum(live), all: live }, hold: { ...sum(hold), all: hold } }, null, 1));
}

// 네트워크 기록: 페이지와 자식(아이프레임) 세션 모두에서 요청·완료를 모은다 — 다른 출처 파일은 페이지 안 기록에 크기가 0으로 남아서
async function netLoad(hold) {
  const net = new Map(); const sessions = new Set();
  const onNet = (msg) => {
    if (!msg.sessionId) return;
    if (msg.method === "Target.attachedToTarget") { sessions.add(msg.params.sessionId); send("Network.enable", {}, msg.params.sessionId).catch(() => {}); return; }
    if (!sessions.has(msg.sessionId)) return;
    const p = msg.params;
    if (msg.method === "Network.requestWillBeSent") net.set(msg.sessionId + p.requestId, { url: p.request.url, t0: p.timestamp, type: p.type, sess: msg.sessionId });
    else if (msg.method === "Network.loadingFinished") { const r = net.get(msg.sessionId + p.requestId); if (r) { r.t1 = p.timestamp; r.kb = Math.round(p.encodedDataLength / 1024); } }
    else if (msg.method === "Network.responseReceived") { const r = net.get(msg.sessionId + p.requestId); if (r) r.tr = p.timestamp; }
  };
  listeners.add(onNet);
  const tab = await openTab(PHONE, mkInstr(hold)); const s = tab.s; sessions.add(s);
  try {
    await send("Network.clearBrowserCache", {}, s);
    await send("Page.navigate", { url: ORIGIN + "/" }, s);
    const t0 = Date.now(); let ready = null;
    while (Date.now() - t0 < 120000) { ready = await ev(s, "window.__m && window.__m.firstSongFrame"); if (ready) break; await sleep(150); }
    await sleep(1500);
    const all = [...net.values()].filter((r) => r.t1);
    const nav = Math.min(...all.map((r) => r.t0));
    const songs = all.filter((r) => r.url.includes("bff/map/songs") && r.kb > 100)[0];
    const ms = (t) => Math.round((t - nav) * 1000);
    const short = (u) => u.split("?")[0].split("/").slice(2).join("/").slice(-58);
    const overlap = songs ? all.filter((r) => r !== songs && r.t0 < songs.t1 && r.t1 > songs.t0 && r.kb > 10).map((r) => [short(r.url), ms(r.t0), ms(r.t1), r.kb, r.sess === s ? "페이지" : "자식"]).sort((a, b) => b[3] - a[3]) : null;
    const big = all.filter((r) => r.kb > 50 && ms(r.t0) < (ready || 1e9) + 500).map((r) => [short(r.url), ms(r.t0), ms(r.t1), r.kb, r.sess === s ? "페이지" : "자식"]).sort((a, b) => a[1] - b[1]);
    return { hold, ready: Math.round(ready), songs: songs ? [ms(songs.t0), songs.tr ? ms(songs.tr) : null, ms(songs.t1), songs.kb] : null, overlap, big, totalKbBeforeReady: all.filter((r) => ms(r.t1) <= ready + 0).reduce((a, r) => a + r.kb, 0) };
  } finally { listeners.delete(onNet); await tab.close(); }
}

if (MODE === "cover") await coverBench(Number(N), Number(CPU));
else if (MODE === "load") await loadBench(Number(N));
else if (MODE === "loadwarm") await loadBench(Number(N), true);
else if (MODE === "netlog") { for (let i = 0; i < Number(N); i++) for (const h of i % 2 ? [true, false] : [false, true]) console.log(JSON.stringify(await netLoad(h))); }
process.exit(0);