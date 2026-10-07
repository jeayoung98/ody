/**
 * 가려진 지도 멈춤 비포·애프터 비용 (S15P21A405-737) — 비포 빌드(3001)와 애프터 빌드(3000)를 번갈아 잰다.
 *   node scripts/covered-map/bench.mjs [rounds=3] [cpu=4]
 * 한 회: 폰 화면(390×844 DPR3)으로 지도를 띄우고 → 지도 화면 6초 → 랭킹 탭 8초. 메인 스레드(Performance.getMetrics 의
 * TaskDuration·ScriptDuration)와 화면 갱신(rAF 수)을 잰다. 페이지에 계측을 끼우지 않는다.
 * 두 빌드를 띄우는 법·로그인 복사는 scripts/README.md. 기준 측정까지 묶은 실행은 run.sh.
 */
const PORT = "9335";
const ORIGINS = { before: "http://localhost:3001", after: "http://localhost:3000" };
const [N = "3", CPU = "4"] = process.argv.slice(2);
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";
const BLOCK = ["*posthog.com*", "*google-analytics.com*", "*googletagmanager.com*"];
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const listeners = new Set();
ws.addEventListener("message", (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) rej(new Error(msg.error.message)); else res(msg.result); } else for (const l of listeners) l(msg); });
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (s, expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result.value;
const q = (a, p) => { const s = [...a].filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };

async function windowMetrics(s, secs) {
  await ev(s, `(() => { window.__pf = []; window.__pfRec = true; if (!window.__pfOn) { window.__pfOn = true; let last = 0; const f = (ts) => { if (window.__pfRec) { if (last) window.__pf.push(ts - last); last = ts; } else last = 0; requestAnimationFrame(f); }; requestAnimationFrame(f); } })()`);
  const m = async () => Object.fromEntries((await send("Performance.getMetrics", {}, s)).metrics.map((x) => [x.name, x.value]));
  const m0 = await m(); const t0 = Date.now(); await sleep(secs * 1000); const m1 = await m(); const wall = (Date.now() - t0) / 1000;
  const pf = await ev(s, "(window.__pfRec = false, window.__pf)"); const vis = await ev(s, "document.visibilityState");
  return { task: Math.round(((m1.TaskDuration - m0.TaskDuration) / wall) * 1000), script: Math.round(((m1.ScriptDuration - m0.ScriptDuration) / wall) * 1000),
    fps: Math.round((pf.length / wall) * 10) / 10, gapP90: Math.round((q(pf, 0.9) ?? 0) * 10) / 10, vis };
}
async function run(build, cpu) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  try {
    await send("Page.enable", {}, s); await send("Runtime.enable", {}, s); await send("Performance.enable", {}, s); await send("Network.enable", {}, s);
    await send("Network.setBlockedURLs", { urls: BLOCK }, s);
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, s);
    await send("Emulation.setUserAgentOverride", { userAgent: UA }, s);
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, s);
    await send("Emulation.setCPUThrottlingRate", { rate: cpu }, s);
    await send("Page.bringToFront", {}, s);
    let songs = false; const onNet = (msg) => { if (msg.sessionId === s && msg.method === "Network.responseReceived" && msg.params.response.url.includes("bff/map/songs")) songs = true; };
    listeners.add(onNet);
    await send("Page.navigate", { url: ORIGINS[build] + "/" }, s);
    const t0 = Date.now(); while (!songs && Date.now() - t0 < 60000) await sleep(200);
    listeners.delete(onNet);
    await sleep(6000);
    const path = await ev(s, "location.pathname");
    const map = await windowMetrics(s, 6);
    const tab = await ev(s, `(() => { const b = document.querySelector('[data-tabbar] button[aria-label="랭킹"]'); if (!b) return 'no-tab'; b.click(); return 'ok'; })()`);
    await sleep(3000);
    const panel = await ev(s, "!!document.querySelector('[data-panel-screen]')");
    const covered = await windowMetrics(s, 8);
    return { build, cpu, path, tab, panel, map, covered };
  } finally { await send("Target.closeTarget", { targetId }).catch(() => {}); }
}
const out = { before: [], after: [] };
for (let i = 0; i < Number(N); i++) for (const b of i % 2 ? ["after", "before"] : ["before", "after"]) { const r = await run(b, Number(CPU)); out[b].push(r); }
const med = (a, k1, k2) => q(a.map((x) => x[k1][k2]), 0.5);
const sum = (a) => ({ map: { task: med(a, "map", "task"), fps: med(a, "map", "fps") }, covered: { task: med(a, "covered", "task"), script: med(a, "covered", "script"), fps: med(a, "covered", "fps"), gapP90: med(a, "covered", "gapP90") } });
console.log(JSON.stringify({ cpu: Number(CPU), runs: out.before.length, ok: [...out.before, ...out.after].every((r) => r.path === "/" && r.tab === "ok" && r.panel && r.map.vis === "visible" && r.covered.vis === "visible"),
  before: sum(out.before), after: sum(out.after), raw: { before: out.before.map((r) => [r.map.task, r.covered.task, r.covered.fps]), after: out.after.map((r) => [r.map.task, r.covered.task, r.covered.fps]) } }));
process.exit(0);