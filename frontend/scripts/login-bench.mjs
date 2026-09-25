/**
 * 로딩 기준선 — 로그인 상태에서 "첫 곡이 그려지기까지" 를 망·CPU 를 고정해 잰다 (S15P21A405-438)
 *
 * perf-bench.js 와 다르다. 저건 개발 빌드에서 **그리기**를 재고, 이건 배포본에서 **로딩**을 잰다.
 * 배포 빌드엔 `window.__odyEngine` 이 없어서 perf-bench.js 가 못 돈다.
 *
 * 쓰는 법 (PowerShell/Git Bash):
 *   1. 임시 프로필로 크롬을 띄운다. 사이트 격리를 꺼야 유튜브 iframe 이 지도와 같은 망·CPU 를 나눠 쓴다(iOS 방식)
 *      "C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9335 \
 *        --user-data-dir=<임시폴더> --no-first-run --disable-extensions \
 *        --disable-site-isolation-trials --disable-features=IsolateOrigins,site-per-process https://j15a405.p.ssafy.io/login
 *   2. 그 창에서 **직접 로그인**한다 (이메일당 refresh token 이 하나라 다른 기기 세션이 풀린다)
 *   3. node scripts/login-bench.mjs 9335 phone,desktop 3
 *      프로필: phone(CPU×4·LTE 10Mbps/60ms·390x844 DPR3) · phonefast(CPU×4·망 감속 없음) · weak(CPU×4·1.6Mbps/150ms)
 *              · desktop(감속 없음·1600x900 DPR2)
 *      프로필마다 첫 방문(캐시 비움) N회 + 재방문 N회. `DETAIL=1` 을 앞에 붙이면 회차별 줄도 찍는다
 *
 * 결과는 PERF-LOG.md 에 손으로 옮긴다. 2026-09-26 기준선이 거기 있다 — 개선 뒤에 같은 명령으로 다시 잰다.
 * PostHog·GA 전송은 막는다(사용자 테스트 데이터 오염 방지). 전·후 모두 막으므로 비교에는 영향이 없다.
 */
//   profiles: phone | desktop | weak     각 프로필마다 cold(빈 캐시) runs 회 + warm(재방문) runs 회
const [PORT = "9335", PROFILES = "phone,desktop", RUNS = "3"] = process.argv.slice(2);
const ORIGIN = "https://j15a405.p.ssafy.io";
const BLOCK = ["*posthog.com*", "*google-analytics.com*", "*googletagmanager.com*"]; // 사용자 테스트 분석 오염 방지 (전·후 동일)

const P = {
  phone: { label: "폰 · CPU×4 · LTE 10Mbps/60ms · 390x844 DPR3", cpu: 4, net: { latency: 60, down: 10e6 / 8, up: 5e6 / 8 }, w: 390, h: 844, dpr: 3, mobile: true },
  weak: { label: "폰 · CPU×4 · 약한 신호 1.6Mbps/150ms · 390x844 DPR3", cpu: 4, net: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 }, w: 390, h: 844, dpr: 3, mobile: true },
  // 폰 + 빠른 와이파이 — 망은 빠르고 CPU 만 느리다. 유튜브가 첫 곡 전에 도착해 CPU 를 두고 겹치는지 보는 조건
  phonefast: { label: "폰 · CPU×4 · 망 감속 없음 · 390x844 DPR3", cpu: 4, net: null, w: 390, h: 844, dpr: 3, mobile: true },
  desktop: { label: "데스크톱 · 감속 없음 · 1600x900 DPR2", cpu: 1, net: null, w: 1600, h: 900, dpr: 2, mobile: false },
};
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36";

const INSTR = `(() => {
  const m = window.__m = { songsJson: 0, firstSongFrame: 0, lt: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => m.lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const oj = Response.prototype.json;
  Response.prototype.json = async function () { const u = this.url; const v = await oj.call(this); if (/map\\/songs/.test(u) && !m.songsJson) m.songsJson = performance.now(); return v; };
  const C = CanvasRenderingContext2D.prototype, oDI = C.drawImage; let inF = false, neb = false, stars = 0;
  C.drawImage = function (img, ...a) { if (inF && this.canvas.width > 500) { if (img.width === 208) neb = true; else if (neb && img.width === 48) stars++; } return oDI.call(this, img, ...a); };
  const oR = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) { return oR.call(window, (ts) => { inF = true; neb = false; stars = 0; try { fn(ts); } finally { inF = false; if (!m.firstSongFrame && stars > 200) m.firstSongFrame = performance.now(); } }); };
})();`;

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const listeners = new Set();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(msg.error.message));
    else res(msg.result);
  } else for (const l of listeners) l(msg);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

async function applyConditions(p, sid) {
  await send("Network.enable", {}, sid);
  await send("Network.setBlockedURLs", { urls: BLOCK }, sid);
  await send("Emulation.setCPUThrottlingRate", { rate: p.cpu }, sid);
  if (p.net) await send("Network.emulateNetworkConditions", { offline: false, latency: p.net.latency, downloadThroughput: p.net.down, uploadThroughput: p.net.up }, sid);
}

async function run(p, cold) {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const reqs = new Map(); let base = null;
  const onMsg = async (msg) => {
    if (msg.method === "Target.attachedToTarget" && msg.params.waitingForDebugger) { // 다른 프로세스 iframe 이 생기면 같은 조건을 건다
      const cs = msg.params.sessionId;
      try { await applyConditions(p, cs); } catch {}
      send("Runtime.runIfWaitingForDebugger", {}, cs).catch(() => {});
    }
    if (msg.method === "Network.requestWillBeSent") {
      if (base === null && msg.params.type === "Document" && msg.params.request.url.startsWith(ORIGIN)) base = msg.params.timestamp;
      reqs.set(msg.sessionId + msg.params.requestId, { url: msg.params.request.url, t0: msg.params.timestamp });
    }
    if (msg.method === "Network.loadingFinished") { const r = reqs.get(msg.sessionId + msg.params.requestId); if (r) { r.t1 = msg.params.timestamp; r.bytes = msg.params.encodedDataLength; } }
  };
  listeners.add(onMsg);
  await send("Page.enable", {}, s); await send("Runtime.enable", {}, s);
  await applyConditions(p, s);
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, s);
  if (cold) await send("Network.clearBrowserCache", {}, s);
  await send("Emulation.setDeviceMetricsOverride", { width: p.w, height: p.h, deviceScaleFactor: p.dpr, mobile: p.mobile }, s);
  if (p.mobile) await send("Emulation.setUserAgentOverride", { userAgent: UA }, s);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: INSTR }, s);
  const t0 = Date.now();
  await send("Page.navigate", { url: ORIGIN + "/" }, s);
  let m = null;
  while (Date.now() - t0 < 120000) {
    const { result } = await send("Runtime.evaluate", { expression: "window.__m && window.__m.firstSongFrame ? JSON.stringify(window.__m) : ''", returnByValue: true }, s);
    if (result.value) { m = JSON.parse(result.value); break; }
    await sleep(200);
  }
  await sleep(1500);
  const { result } = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const nav = performance.getEntriesByType('navigation')[0]; const R = performance.getEntriesByType('resource');
      const sg = R.find(r => /bff\\/map\\/songs/.test(r.name)); const me = R.find(r => /bff\\/auth\\/me/.test(r.name));
      const yt = R.find(r => /youtube\\.com\\/iframe_api/.test(r.name));
      return { path: location.pathname, fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1),
        songsStart: sg && Math.round(sg.startTime), songsTtfb: sg && Math.round(sg.responseStart), songsEnd: sg && Math.round(sg.responseEnd), songsKB: sg && Math.round((sg.transferSize || sg.encodedBodySize) / 1024),
        meStart: me && Math.round(me.startTime), ytApiStart: yt ? Math.round(yt.startTime) : null,
        iframes: [...document.querySelectorAll('iframe')].map(f => (f.src || '').replace(/\\?.*/, '').slice(0, 40)) };
    })()`,
  }, s);
  listeners.delete(onMsg);
  await send("Target.closeTarget", { targetId });
  const v = result.value; const fsf = m?.firstSongFrame ?? null;
  const cut = base !== null && fsf ? base + fsf / 1000 : Infinity;
  let bytesBefore = 0, ytBytesBefore = 0, ytBytesAll = 0;
  for (const r of reqs.values()) {
    if (!r.bytes) continue;
    const isYt = /youtube\.com|ytimg\.com|googlevideo\.com|fonts\.gstatic\.com|www\.google\.com\/js\/th/.test(r.url);
    if (isYt) ytBytesAll += r.bytes;
    if (r.t1 !== undefined && r.t1 <= cut) { bytesBefore += r.bytes; if (isYt) ytBytesBefore += r.bytes; }
  }
  const lt = (m?.lt ?? []).filter(([t]) => !fsf || t <= fsf);
  return {
    firstSongFrame: fsf && Math.round(fsf), songsJsonDone: m?.songsJson && Math.round(m.songsJson), ...v,
    kbBeforeFirstSong: Math.round(bytesBefore / 1024), ytKbBeforeFirstSong: Math.round(ytBytesBefore / 1024), ytKbTotal: Math.round(ytBytesAll / 1024),
    longTasksBeforeFirstSong: lt.length, longTaskMsBeforeFirstSong: lt.reduce((a, [, d]) => a + d, 0),
  };
}

// 같은 창의 다른 탭을 빈 페이지로 돌린다 (2026-09-26 확인). 로그인해 둔 지도 탭이 떠 있으면 매 프레임 그리느라 CPU 를 나눠 써서,
// 같은 조건인데 첫 곡이 1초 가까이 늦고 50ms↑ 작업이 2~3배로 잡혔다. 로그인은 저장소에 남아 있으니 탭을 비워도 풀리지 않는다
for (const t of (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.url !== "about:blank")) {
  const { sessionId: s } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
  await send("Page.navigate", { url: "about:blank" }, s).catch(() => {});
  await send("Target.detachFromTarget", { sessionId: s }).catch(() => {});
}

// 로그인 확인 + 토큰 예열 (만료돼 있으면 앱이 여기서 재발급한다 — 측정 중 401→재발급이 끼지 않게)
{
  const { targetId } = await send("Target.createTarget", { url: ORIGIN + "/" });
  await sleep(8000);
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const { result } = await send("Runtime.evaluate", { expression: "(() => { try { return !!localStorage.getItem('ody:access-token') && location.pathname } catch (e) { return String(e) } })()", returnByValue: true }, s);
  await send("Target.closeTarget", { targetId });
  if (result.value !== "/") { console.log(JSON.stringify({ error: "로그인 안 됨", at: result.value })); ws.close(); process.exit(2); }
}

for (const name of PROFILES.split(",")) {
  const p = P[name]; const out = { profile: p.label, cold: [], warm: [] };
  for (let i = 0; i < Number(RUNS); i++) out.cold.push(await run(p, true));
  await run(p, false); // 캐시 예열
  for (let i = 0; i < Number(RUNS); i++) out.warm.push(await run(p, false));
  const sum = (arr) => ({
    firstSong_ms: arr.map((r) => r.firstSongFrame), median: q(arr.map((r) => r.firstSongFrame ?? 1e9), 0.5),
    songsStart: q(arr.map((r) => r.songsStart ?? 0), 0.5), songsEnd: q(arr.map((r) => r.songsEnd ?? 0), 0.5), songsKB: arr[0].songsKB,
    kbBeforeFirstSong: q(arr.map((r) => r.kbBeforeFirstSong), 0.5), ytKbBeforeFirstSong: q(arr.map((r) => r.ytKbBeforeFirstSong), 0.5), ytKbTotal: q(arr.map((r) => r.ytKbTotal), 0.5),
    ytApiStart: q(arr.map((r) => r.ytApiStart ?? -1), 0.5), longTasks: q(arr.map((r) => r.longTasksBeforeFirstSong), 0.5), longTaskMs: q(arr.map((r) => r.longTaskMsBeforeFirstSong), 0.5),
    fcp: q(arr.map((r) => r.fcp), 0.5), paths: [...new Set(arr.map((r) => r.path))],
  });
  // DETAIL=1 이면 회차별로 찍는다 — 유튜브가 첫 곡 전에 겹친 회차와 안 겹친 회차를 가르려면 필요하다
  if (process.env.DETAIL === "1") for (const [k, arr] of [["cold", out.cold], ["warm", out.warm]]) for (const r of arr) console.log(JSON.stringify({ profile: name, k, firstSong: r.firstSongFrame, meStart: r.meStart, songsStart: r.songsStart, songsEnd: r.songsEnd, songsJsonDone: r.songsJsonDone, ytKbBefore: r.ytKbBeforeFirstSong, ytKbTotal: r.ytKbTotal, lt: r.longTasksBeforeFirstSong, ltMs: r.longTaskMsBeforeFirstSong }));
  console.log(JSON.stringify({ profile: out.profile, cold: sum(out.cold), warm: sum(out.warm) }, null, 1));
}
ws.close();
