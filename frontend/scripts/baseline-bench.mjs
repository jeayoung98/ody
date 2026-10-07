/**
 * 기준선 측정 — 로컬 배포용 빌드(standalone)에 CDP 로 붙어 잰다 (2026-10-06~07, S15P21A405-737 조사 중)
 *   node scripts/baseline-bench.mjs wait-login         측정용 크롬에서 직접 로그인할 때까지 기다린다
 *   node scripts/baseline-bench.mjs cover [rounds]     폰에서 지도 화면 vs 탭 화면이 지도를 덮었을 때의 프레임 비용
 *   node scripts/baseline-bench.mjs js-login [runs]    비로그인 첫 화면(/login) JS 크기·사용률·폰 조건 긴 작업
 *   node scripts/baseline-bench.mjs js-home [runs]     로그인 첫 화면(/) JS 크기·사용률·첫 곡까지·긴 작업
 *   node scripts/baseline-bench.mjs ab [runs]          폰 CPU×4·LTE: 첫 방문 · 재방문 · PostHog 묶음 막은 첫 방문을 번갈아
 *   node scripts/baseline-bench.mjs cpuprofile         첫 곡까지 샘플링 프로파일을 묶음별로 (WARM=1 이면 재방문)
 * 기준 측정: `COVER_CPU=1 node scripts/baseline-bench.mjs cover 1` 의 지도 한 프레임(map.frameMsMed)을 묶음 앞뒤에 잰다.
 *   PC 속도가 부하 이력·전원에 따라 2배까지 달라져서(배터리로 연속 부하 → 약 50ms), 15% 넘게 흔들린 묶음은 버린다.
 * 환경변수: ORIGIN(기본 http://localhost:3000) · CDP_PORT(9335) · STAR_MIN(첫 곡 판정 곡 별 수, 20) · COVER_CPU
 * 준비(측정용 크롬·로그인)는 scripts/README.md. PostHog·GA 는 막는다(분석 오염 방지, 전·후 동일).
 */
const PORT = process.env.CDP_PORT || "9335";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const STAR_MIN = Number(process.env.STAR_MIN || 20);
const BLOCK = ["*posthog.com*", "*google-analytics.com*", "*googletagmanager.com*"];
const [MODE = "cover", N = "3"] = process.argv.slice(2);
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const PHONE = { label: "폰 390x844 DPR3 · CPU×4 · LTE 10Mbps/60ms", cpu: 4, net: { latency: 60, down: 10e6 / 8, up: 5e6 / 8 }, w: 390, h: 844, dpr: 3, mobile: true };
const COVER_CPU = Number(process.env.COVER_CPU || 4);
const PHONE_FAST = { ...PHONE, label: `폰 390x844 DPR3 · CPU×${COVER_CPU} · 망 감속 없음`, cpu: COVER_CPU, net: null };
const DESKTOP = { label: "데스크톱 1600x900 DPR2 · 감속 없음", cpu: 1, net: null, w: 1600, h: 900, dpr: 2, mobile: false };
const PHONE_BLOCK = { ...PHONE, label: PHONE.label + " · PostHog 묶음 막음", block: ["*1fir7o21rn03w.js*"] };
const WORST = { ...PHONE, label: "폰 390x844 DPR3 · CPU×6 · 약한 신호 1.6Mbps/150ms", cpu: 6, net: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 } };

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

const INSTR = `(() => {
  const m = window.__m = { firstSongFrame: 0, lt: [], vis: [], frames: [], rec: false };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => m.lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const oj = Response.prototype.json; Response.prototype.json = async function () { const u = this.url; const v = await oj.call(this); try { if (/bff\\/map\\/songs/.test(u) && /level=1/.test(u) && v && Array.isArray(v.data) && m.layer1Songs == null) m.layer1Songs = v.data.length; } catch (e) {} return v; };
  document.addEventListener('visibilitychange', () => m.vis.push([Math.round(performance.now()), document.visibilityState]));
  const C = CanvasRenderingContext2D.prototype, oDI = C.drawImage;
  let inF = false, neb = false, stars = 0, draws = 0, cur = null;
  C.drawImage = function (img, ...a) { if (inF && this.canvas.width > 500) { draws++; if (img.width === 208) neb = true; else if (neb && img.width === 48) stars++; } return oDI.call(this, img, ...a); };
  const oR = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) { return oR.call(window, (ts) => {
    if (!cur || cur.ts !== ts) { if (cur && m.rec) m.frames.push(cur); cur = { ts, ms: 0, draws: 0 }; }
    inF = true; neb = false; stars = 0; draws = 0; const t0 = performance.now();
    try { fn(ts); } finally { cur.ms += performance.now() - t0; cur.draws += draws; inF = false; if (!m.firstSongFrame && stars > ${STAR_MIN}) { m.firstSongFrame = performance.now(); try { performance.mark('ody-first-song'); } catch (e) {} } }
  }); };
  m.start = () => { m.frames = []; cur = null; m.rec = true; };
  m.stop = () => { if (cur) m.frames.push(cur); m.rec = false; const f = m.frames.map(x => [Math.round(x.ms * 100) / 100, x.draws]); m.frames = []; return f; };
})();`;

async function applyConditions(p, s) {
  await send("Network.enable", {}, s);
  await send("Network.setBlockedURLs", { urls: BLOCK.concat(p.block || []) }, s);
  await send("Emulation.setCPUThrottlingRate", { rate: p.cpu }, s);
  await send("Network.emulateNetworkConditions", p.net ? { offline: false, latency: p.net.latency, downloadThroughput: p.net.down, uploadThroughput: p.net.up } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, s);
}
async function openTab(p, { context, instr = true } = {}) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank", ...(context ? { browserContextId: context } : {}) });
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
  if (p.mobile) await send("Emulation.setUserAgentOverride", { userAgent: UA }, s);
  if (p.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, s);
  if (instr) await send("Page.addScriptToEvaluateOnNewDocument", { source: INSTR }, s);
  return { targetId, s, close: async () => { listeners.delete(onAttach); await send("Target.closeTarget", { targetId }).catch(() => {}); } };
}
async function blankOtherTabs() {
  for (const t of (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.url !== "about:blank")) {
    const { sessionId: s } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    await send("Page.navigate", { url: "about:blank" }, s).catch(() => {});
    await send("Target.detachFromTarget", { sessionId: s }).catch(() => {});
  }
}
async function ensureLogin() {
  const { targetId } = await send("Target.createTarget", { url: ORIGIN + "/" });
  await sleep(8000);
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const v = await ev(s, "(() => { try { return !!localStorage.getItem('ody:access-token') && location.pathname } catch (e) { return String(e) } })()");
  await send("Target.closeTarget", { targetId });
  if (v !== "/") { console.log(JSON.stringify({ error: "로그인 안 됨", at: v })); process.exit(2); }
}
const metricsOf = (r) => Object.fromEntries(r.metrics.map((x) => [x.name, x.value]));
async function waitFirstSong(s, ms = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await ev(s, "window.__m && window.__m.firstSongFrame"); if (v) return v; await sleep(200); }
  return null;
}

async function measureWindow(s, secs) {
  await ev(s, "window.__m.start()");
  const m0 = metricsOf(await send("Performance.getMetrics", {}, s)); const t0 = Date.now();
  await sleep(secs * 1000);
  const m1 = metricsOf(await send("Performance.getMetrics", {}, s)); const wall = (Date.now() - t0) / 1000;
  const f = await ev(s, "window.__m.stop()");
  const info = await ev(s, `(() => { const ps = document.querySelector('[data-panel-screen]'); const r = ps && ps.getBoundingClientRect();
    return { path: location.pathname, vis: document.visibilityState, screen: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null, vw: innerWidth, vh: innerHeight }; })()`);
  const ms = f.map((x) => x[0]), dr = f.map((x) => x[1]);
  return { ...info, frames: f.length, fps: r1(f.length / wall), frameMsMed: r1(q(ms, 0.5)), frameMsP90: r1(q(ms, 0.9)), drawsMed: q(dr, 0.5),
    taskMsPerSec: r1(((m1.TaskDuration - m0.TaskDuration) / wall) * 1000), scriptMsPerSec: r1(((m1.ScriptDuration - m0.ScriptDuration) / wall) * 1000) };
}
const clickTab = (s, label) => ev(s, `(() => { const b = document.querySelector('[data-tabbar] button[aria-label="${label}"]'); if (!b) return 'no-tab'; if (b.disabled) return 'disabled'; b.click(); return 'ok'; })()`);

async function cover(rounds) {
  await blankOtherTabs(); await ensureLogin();
  const tab = await openTab(PHONE_FAST); const s = tab.s;
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  const fs = await waitFirstSong(s); if (!fs) console.log(JSON.stringify({ warn: "첫 곡 판정 실패", STAR_MIN }));
  await sleep(6000);
  const songs = await ev(s, "fetch('/bff/map/songs?level=1', { headers: { Authorization: 'Bearer ' + localStorage.getItem('ody:access-token') } }).then(r => r.json()).then(j => { const d = j && j.data; const a = Array.isArray(d) ? d : (d && (d.songs || d.items)); return a ? a.length : null; }).catch(() => null)");
  const tabs = await ev(s, "[...document.querySelectorAll('[data-tabbar] button')].map(b => b.getAttribute('aria-label') + (b.disabled ? '(off)' : ''))");
  const cov = tabs.includes("랭킹") ? "랭킹" : tabs.includes("마이페이지") ? "마이페이지" : "주변 사람";
  const out = { cond: PHONE_FAST.label, layer1Songs: songs, tabs, coveringTab: cov, map: [], covered: [] };
  for (let i = 0; i < rounds; i++) {
    await clickTab(s, "지도"); await sleep(3000); out.map.push(await measureWindow(s, 10));
    out.clickCover = await clickTab(s, cov); await sleep(3000); out.covered.push(await measureWindow(s, 10));
  }
  await clickTab(s, "지도");
  out.vis = await ev(s, "window.__m.vis");
  const sum = (a) => ({ fps: q(a.map((x) => x.fps), 0.5), frameMsMed: q(a.map((x) => x.frameMsMed), 0.5), frameMsP90: q(a.map((x) => x.frameMsP90), 0.5), drawsMed: q(a.map((x) => x.drawsMed), 0.5), taskMsPerSec: q(a.map((x) => x.taskMsPerSec), 0.5), scriptMsPerSec: q(a.map((x) => x.scriptMsPerSec), 0.5), paths: [...new Set(a.map((x) => x.path))], screen: a[0] && a[0].screen });
  console.log(JSON.stringify({ ...out, summary: { map: sum(out.map), covered: sum(out.covered) } }, null, 1));
  await tab.close();
}

function disjoint(ranges) {
  const pts = [];
  for (const r of ranges) { pts.push({ o: r.startOffset, t: 0, r }); pts.push({ o: r.endOffset, t: 1, r }); }
  pts.sort((a, b) => { if (a.o !== b.o) return a.o - b.o; if (a.t !== b.t) return b.t - a.t; const al = a.r.endOffset - a.r.startOffset, bl = b.r.endOffset - b.r.startOffset; return a.t === 0 ? bl - al : al - bl; });
  const st = [], res = []; let last = 0;
  for (const p of pts) {
    if (st.length && last < p.o && st[st.length - 1] > 0) { const lr = res[res.length - 1]; if (lr && lr.e === last) lr.e = p.o; else res.push({ s: last, e: p.o }); }
    last = p.o; if (p.t === 0) st.push(p.r.count); else st.pop();
  }
  return res.reduce((a, r) => a + (r.e - r.s > 1 ? r.e - r.s : 0), 0);
}
async function coverage(path, { context, waitFor, p = DESKTOP }) {
  const tab = await openTab(p, { context }); const s = tab.s;
  await send("Debugger.enable", {}, s); await send("Profiler.enable", {}, s);
  await send("Profiler.startPreciseCoverage", { callCount: false, detailed: true }, s);
  await send("Network.clearBrowserCache", {}, s);
  await send("Page.navigate", { url: ORIGIN + path }, s);
  const t0 = Date.now(); while (Date.now() - t0 < 90000) { if (await ev(s, waitFor)) break; await sleep(200); }
  await sleep(3000);
  const { result } = await send("Profiler.takePreciseCoverage", {}, s);
  let total = 0, used = 0; const per = [];
  for (const e of result) {
    if (!/\/_next\/static\//.test(e.url)) continue;
    let len = 0; try { len = (await send("Debugger.getScriptSource", { scriptId: e.scriptId }, s)).scriptSource.length; } catch { continue; }
    const u = Math.min(len, disjoint(e.functions.flatMap((f) => f.ranges)));
    total += len; used += u; per.push([e.url.replace(/.*\/_next\/static\//, ""), Math.round(len / 1024), Math.round(u / 1024)]);
  }
  const res = await ev(s, `(() => { const R = performance.getEntriesByType('resource').filter(r => /\\.js(\\?|$)/.test(r.name) && r.name.includes('/_next/static/'));
    return { jsFiles: R.length, jsTransferKB: Math.round(R.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024), jsDecodedKB: Math.round(R.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024) }; })()`);
  await tab.close();
  per.sort((a, b) => b[1] - a[1]);
  return { path, ...res, parsedKB: Math.round(total / 1024), usedKB: Math.round(used / 1024), unusedPct: total ? Math.round((1 - used / total) * 100) : null, biggest: per.slice(0, 8) };
}
async function timedLoad(p, path, { context, readyExpr, clear = true }) {
  const tab = await openTab(p, { context }); const s = tab.s;
  if (clear) await send("Network.clearBrowserCache", {}, s);
  await send("Page.navigate", { url: ORIGIN + path }, s);
  const t0 = Date.now(); let readyAt = null;
  while (Date.now() - t0 < 120000) { readyAt = await ev(s, readyExpr); if (readyAt) break; await sleep(150); }
  await sleep(1000);
  const v = await ev(s, `(() => { const m = window.__m; const ready = ${readyAt || 0};
    const lt = m.lt.filter(([t]) => !ready || t <= ready); const R = performance.getEntriesByType('resource').filter(r => /\\.js(\\?|$)/.test(r.name) && r.name.includes('/_next/static/'));
    const before = R.filter(r => !ready || r.responseEnd <= ready);
    return { ready: Math.round(ready), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1),
      longTasks: lt.length, longTaskMs: lt.reduce((a, [, d]) => a + d, 0), tbt: lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0),
      jsKBBefore: Math.round(before.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024), jsFilesBefore: before.length,
      layer1Songs: m.layer1Songs ?? null, ytApi: (() => { const y = performance.getEntriesByType('resource').find(r => /youtube\\.com\\/iframe_api/.test(r.name)); return y ? Math.round(y.startTime) : null; })(), hidden: m.vis.some(([t, v]) => v === 'hidden' && (!ready || t <= ready)), path: location.pathname }; })()`);
  await tab.close();
  return v;
}
const summarize = (a) => { const ok = a.filter((x) => x && x.ready && !x.hidden); return { runs: a.length, valid: ok.length, readyMed: q(ok.map((x) => x.ready), 0.5), fcpMed: q(ok.map((x) => x.fcp), 0.5), longTasksMed: q(ok.map((x) => x.longTasks), 0.5), longTaskMsMed: q(ok.map((x) => x.longTaskMs), 0.5), tbtMed: q(ok.map((x) => x.tbt), 0.5), jsKBBeforeMed: q(ok.map((x) => x.jsKBBefore), 0.5), ytBeforeFirst: ok.filter((x) => x.ytApi != null && x.ytApi < x.ready).length, all: a.map((x) => x && [x.ready, x.longTasks, x.tbt, x.jsKBBefore, x.ytApi, x.hidden ? "H" : ""]) }; };

async function jsLogin(runs) {
  const ctx = async () => (await send("Target.createBrowserContext", {})).browserContextId;
  const out = { coverage: await coverage("/login", { context: await ctx(), waitFor: "!!document.querySelector('input[type=email]')" }) };
  const readyExpr = "(() => { const el = document.querySelector('input[type=email]'); if (!el) return 0; const vis = el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0; const hyd = Object.keys(el).some(k => k.startsWith('__reactProps')); return vis && hyd ? performance.now() : 0; })()";
  const phone = []; for (let i = 0; i < runs; i++) phone.push(await timedLoad(PHONE, "/login", { context: await ctx(), readyExpr }));
  out.phone = { cond: PHONE.label, ...summarize(phone) };
  console.log(JSON.stringify(out, null, 1));
}
async function jsHome(runs) {
  await blankOtherTabs(); await ensureLogin();
  const out = { coverage: await coverage("/", { waitFor: "window.__m && window.__m.firstSongFrame" }) };
  const readyExpr = "window.__m && window.__m.firstSongFrame";
  for (const p of [PHONE, DESKTOP]) { const a = []; for (let i = 0; i < runs; i++) a.push(await timedLoad(p, "/", { readyExpr })); out[p === PHONE ? "phone" : "desktop"] = { cond: p.label, ...summarize(a) }; }
  console.log(JSON.stringify(out, null, 1));
}

async function homeVariants(runs) {
  await blankOtherTabs(); await ensureLogin();
  const readyExpr = "window.__m && window.__m.firstSongFrame";
  const out = {};
  for (let i = 0; i < 2; i++) await timedLoad(PHONE, "/", { readyExpr, clear: i === 0 }); // 캐시·코드 캐시 예열
  const warm = []; for (let i = 0; i < runs; i++) warm.push(await timedLoad(PHONE, "/", { readyExpr, clear: false }));
  out.warm = { cond: PHONE.label + " · 재방문(캐시 있음)", ...summarize(warm) };
  const block = []; for (let i = 0; i < runs; i++) block.push(await timedLoad(PHONE_BLOCK, "/", { readyExpr }));
  out.blockPosthog = { cond: PHONE_BLOCK.label, ...summarize(block) };
  const worst = []; for (let i = 0; i < Math.min(runs, 3); i++) worst.push(await timedLoad(WORST, "/", { readyExpr }));
  out.worst = { cond: WORST.label, ...summarize(worst) };
  console.log(JSON.stringify(out, null, 1));
}
const grp = (u) => !u ? "알 수 없음" : /0nzy0v-yoy7cj/.test(u) ? "지도·앱 묶음" : /1fir7o21rn03w/.test(u) ? "PostHog" : /33wmmxu2kkyqh/.test(u) ? "react-dom" : /3kem57d61i4wk/.test(u) ? "Next 라우터" : /0omel5gzh_g8g/.test(u) ? "앱 공용 묶음" : /youtube|ytimg|googlevideo|gstatic|google\.com/.test(u) ? "유튜브" : /_next\/static/.test(u) ? "기타 Next 묶음" : /localhost:3000/.test(u) ? "페이지 HTML·인라인" : "외부";
const SCRIPT = new Set(["EvaluateScript", "v8.compile", "v8.compileModule", "v8.evaluateModule", "v8.produceCache", "v8.produceModuleCache"]);
const CALL = new Set(["FunctionCall", "TimerFire", "FireAnimationFrame", "EventDispatch", "XHRReadyStateChange", "XHRLoad", "RunMicrotasks", "V8.RunMicrotasks"]);
const RENDER = new Set(["ParseHTML", "Layout", "UpdateLayoutTree", "RecalculateStyles", "Paint", "PrePaint", "Layerize", "UpdateLayer", "CompositeLayers", "HitTest", "ScheduleStyleRecalculation"]);
const isGC = (n) => /GC|Garbage/i.test(n);
async function traceLoad(p) {
  await blankOtherTabs(); await ensureLogin();
  const tab = await openTab(p); const s = tab.s;
  await send("Network.clearBrowserCache", {}, s);
  const events = []; let done; const complete = new Promise((r) => (done = r));
  const onMsg = (msg) => { if (msg.method === "Tracing.dataCollected") events.push(...msg.params.value); if (msg.method === "Tracing.tracingComplete") done(); };
  listeners.add(onMsg);
  await send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "v8.execute", "blink.user_timing", "loading"] } });
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  const fs = await waitFirstSong(s); await sleep(1500);
  await send("Tracing.end"); await complete; listeners.delete(onMsg); await tab.close();
  const mark = events.find((e) => e.name === "ody-first-song");
  if (!mark) { console.log(JSON.stringify({ error: "첫 곡 표시를 못 찾음", events: events.length, fs })); return; }
  const navs = events.filter((e) => e.name === "navigationStart" && e.ts < mark.ts && JSON.stringify(e.args || {}).includes("localhost:3000")).sort((a, b) => a.ts - b.ts);
  const t0 = navs.length ? navs[navs.length - 1].ts : Math.min(...events.filter((e) => e.pid === mark.pid && e.ts).map((e) => e.ts));
  const t1 = mark.ts;
  const th = events.filter((e) => e.pid === mark.pid && e.tid === mark.tid && e.ph === "X" && e.ts >= t0 && e.ts <= t1);
  const tasks = th.filter((e) => e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask").sort((a, b) => a.ts - b.ts);
  const longs = tasks.filter((e) => e.dur >= 50000);
  const total = {}; const add = (k, us) => (total[k] = (total[k] || 0) + us);
  const top = [];
  for (const T of longs) {
    const kids = th.filter((e) => e !== T && e.ts >= T.ts && e.ts + (e.dur || 0) <= T.ts + T.dur && e.name !== "RunTask" && e.name !== "ThreadControllerImpl::RunTask").sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    let end = -1, covered = 0; const local = {};
    for (const k of kids) {
      if (k.ts < end) continue;
      const known = SCRIPT.has(k.name) || CALL.has(k.name) || RENDER.has(k.name) || isGC(k.name);
      if (!known) continue;
      end = k.ts + k.dur; covered += k.dur;
      let key;
      if (SCRIPT.has(k.name)) key = "스크립트 평가·컴파일: " + grp(k.args?.data?.url || k.args?.data?.fileName || k.args?.fileName);
      else if (CALL.has(k.name)) {
        let u = k.args?.data?.url;
        if (!u) { const inner = kids.filter((x) => x.name === "FunctionCall" && x.ts >= k.ts && x.ts + x.dur <= k.ts + k.dur).sort((a, b) => b.dur - a.dur)[0]; u = inner?.args?.data?.url; }
        key = "JS 실행: " + grp(u);
      } else if (RENDER.has(k.name)) key = "스타일·레이아웃·페인트·HTML";
      else key = "GC";
      add(key, k.dur); local[key] = (local[key] || 0) + k.dur;
    }
    add("기타(네이티브·기록 안 됨)", Math.max(0, T.dur - covered));
    const main = Object.entries(local).sort((a, b) => b[1] - a[1])[0];
    top.push([Math.round((T.ts - t0) / 1000), Math.round(T.dur / 1000), main ? main[0] : "기타"]);
  }
  const sumLong = longs.reduce((a, e) => a + e.dur, 0);
  console.log(JSON.stringify({ cond: p.label, firstSongMs: Math.round((t1 - t0) / 1000), allTasksMs: Math.round(tasks.reduce((a, e) => a + e.dur, 0) / 1000), longTasks: longs.length, longTaskMs: Math.round(sumLong / 1000),
    breakdown: Object.entries(total).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / 1000), Math.round((v / sumLong) * 100) + "%"]),
    longestTasks: top.sort((a, b) => b[1] - a[1]).slice(0, 10) }, null, 1));
}
async function cpuProfile(p, warm) {
  await blankOtherTabs(); await ensureLogin();
  if (warm) for (let i = 0; i < 2; i++) await timedLoad(p, "/", { readyExpr: "window.__m && window.__m.firstSongFrame", clear: i === 0 });
  const tab = await openTab(p); const s = tab.s;
  if (!warm) await send("Network.clearBrowserCache", {}, s);
  await send("Profiler.enable", {}, s);
  await send("Profiler.setSamplingInterval", { interval: 500 }, s);
  await send("Profiler.start", {}, s);
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  const t0 = Date.now(); let fs = null;
  while (Date.now() - t0 < 120000) { fs = await ev(s, "window.__m && window.__m.firstSongFrame"); if (fs) break; await sleep(100); }
  const { profile } = await send("Profiler.stop", {}, s);
  const lt = await ev(s, "JSON.stringify(window.__m.lt.filter(([t]) => t <= window.__m.firstSongFrame))");
  await tab.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) { const id = profile.samples[i]; self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0)); }
  const cat = (n) => { const f = n.callFrame; if (f.functionName === "(idle)") return "유휴"; if (f.functionName === "(garbage collector)") return "GC"; if (f.functionName === "(program)") return "브라우저 작업(렌더·파싱 등)"; if (f.functionName === "(root)") return "루트"; return f.url ? grp(f.url) : "내장 함수(JSON 파싱 등)"; };
  const groups = {}; const fns = {};
  for (const [id, us] of self) { const n = byId.get(id); const c = cat(n); groups[c] = (groups[c] || 0) + us; const f = n.callFrame; const key = c + " | " + (f.functionName || "(익명)") + (f.url ? " @" + f.url.replace(/.*\//, "") + ":" + (f.lineNumber + 1) + ":" + (f.columnNumber + 1) : ""); fns[key] = (fns[key] || 0) + us; }
  const busy = Object.entries(groups).filter(([k]) => k !== "유휴" && k !== "루트").reduce((a, [, v]) => a + v, 0);
  console.log(JSON.stringify({ cond: p.label + (warm ? " · 재방문" : " · 첫 방문"), firstSongMs: Math.round(fs), profiledMs: Math.round((profile.endTime - profile.startTime) / 1000), busyMs: Math.round(busy / 1000),
    longTasks: JSON.parse(lt).length, longTaskMs: JSON.parse(lt).reduce((a, [, d]) => a + d, 0),
    byGroup: Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / 1000), k === "유휴" || k === "루트" ? "" : Math.round((v / busy) * 100) + "%"]),
    topFunctions: Object.entries(fns).filter(([k]) => !/^유휴|^루트/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v / 1000)]) }, null, 1));
}
async function abRuns(runs) {
  await blankOtherTabs(); await ensureLogin();
  const readyExpr = "window.__m && window.__m.firstSongFrame";
  const A = [], W = [], B = [];
  for (let i = 0; i < runs; i++) {
    A.push(await timedLoad(PHONE, "/", { readyExpr }));
    W.push(await timedLoad(PHONE, "/", { readyExpr, clear: false }));
    B.push(await timedLoad(PHONE_BLOCK, "/", { readyExpr }));
  }
  console.log(JSON.stringify({ cold: { cond: PHONE.label + " · 첫 방문", ...summarize(A) }, warm: { cond: PHONE.label + " · 재방문", ...summarize(W) }, blockPosthog: { cond: PHONE_BLOCK.label + " · 첫 방문", ...summarize(B) } }, null, 1));
}
async function loginDetail(runs) {
  await blankOtherTabs();
  const ctx = async () => (await send("Target.createBrowserContext", {})).browserContextId;
  const readyExpr = "(() => { const el = document.querySelector('input[type=email]'); if (!el) return 0; const vis = el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().height > 0; const hyd = Object.keys(el).some(k => k.startsWith('__reactProps')); return vis && hyd ? performance.now() : 0; })()";
  const phone = []; for (let i = 0; i < runs; i++) phone.push(await timedLoad(PHONE, "/login", { context: await ctx(), readyExpr }));
  // 한 번 더: 묶음별 받은 시각과 지도 묶음의 실행 시간
  const tab = await openTab(PHONE, { context: await ctx() }); const s = tab.s;
  await send("Network.clearBrowserCache", {}, s);
  await send("Profiler.enable", {}, s); await send("Profiler.setSamplingInterval", { interval: 500 }, s); await send("Profiler.start", {}, s);
  await send("Page.navigate", { url: ORIGIN + "/login" }, s);
  const t0 = Date.now(); let ready = 0; while (Date.now() - t0 < 60000) { ready = await ev(s, readyExpr); if (ready) break; await sleep(100); }
  const { profile } = await send("Profiler.stop", {}, s);
  const res = await ev(s, `JSON.stringify(performance.getEntriesByType('resource').filter(r => /\\.js(\\?|$)/.test(r.name)).map(r => [r.name.replace(/.*\\//, ''), Math.round(r.startTime), Math.round(r.responseEnd), Math.round((r.transferSize || 0) / 1024)]).sort((a, b) => a[2] - b[2]))`);
  await tab.close();
  const byId = new Map(profile.nodes.map((n) => [n.id, n])); const g = {};
  for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const f = n.callFrame; const k = f.functionName === "(idle)" ? "유휴" : f.functionName === "(program)" ? "브라우저 작업" : f.functionName === "(garbage collector)" ? "GC" : f.url ? grp(f.url) : (f.functionName === "(root)" ? "루트" : "내장 함수"); g[k] = (g[k] || 0) + (profile.timeDeltas[i] || 0); }
  console.log(JSON.stringify({ phone: { cond: PHONE.label, ...summarize(phone) }, profiledReady: Math.round(ready), jsTimeline: JSON.parse(res), profileByGroup: Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / 1000)]) }, null, 1));
}
if (MODE === "wait-login") {
  const t0 = Date.now();
  while (Date.now() - t0 < 15 * 60 * 1000) {
    for (const t of (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.url.startsWith(ORIGIN))) {
      const { sessionId: s } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
      const v = await ev(s, "(() => { try { return !!localStorage.getItem('ody:access-token') } catch (e) { return false } })()").catch(() => false);
      await send("Target.detachFromTarget", { sessionId: s }).catch(() => {});
      if (v) { console.log("logged-in"); process.exit(0); }
    }
    await sleep(3000);
  }
  console.log("timeout"); process.exit(1);
} else if (MODE === "cover") await cover(Number(N));
else if (MODE === "js-login") await jsLogin(Number(N));
else if (MODE === "js-home") await jsHome(Number(N));
else if (MODE === "home-variants") await homeVariants(Number(N));
else if (MODE === "ab") await abRuns(Number(N));
else if (MODE === "login-detail") await loginDetail(Number(N));
else if (MODE === "trace") await traceLoad(process.env.TRACE_WORST ? WORST : PHONE);
else if (MODE === "cpuprofile") await cpuProfile(process.env.TRACE_WORST ? WORST : PHONE, process.env.WARM === "1");
ws.close();