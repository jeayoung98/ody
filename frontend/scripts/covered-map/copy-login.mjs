/**
 * 측정용 크롬의 로그인 상태를 3000 번에서 3001 번으로 복사한다 (S15P21A405-737)
 *   node scripts/covered-map/copy-login.mjs
 * 비포 빌드(3001)와 애프터 빌드(3000)를 동시에 띄워 번갈아 재려면 둘 다 로그인돼 있어야 한다. 로컬 저장소는 포트마다
 * 따로라 그대로 옮기고, refresh 쿠키는 포트와 상관없이 같이 쓰인다. 3000 번에는 먼저 직접 로그인해 둔다.
 */
const PORT = process.env.CDP_PORT || "9335";
const FROM = process.env.FROM || "http://localhost:3000";
const TO = process.env.TO || "http://localhost:3001";

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } });
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (s, expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result?.result?.value;
const open = async (url) => {
  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, s); await send("Page.navigate", { url }, s);
  return { s, close: () => send("Target.closeTarget", { targetId }) };
};

const a = await open(FROM + "/"); await sleep(9000);
const from = await ev(a.s, "({ path: location.pathname, dump: JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))) })");
await a.close();
if (from?.path !== "/") { console.log(JSON.stringify({ error: `${FROM} 에 로그인돼 있지 않다`, at: from?.path })); process.exit(2); }
const b = await open(TO + "/login"); await sleep(4000);
await ev(b.s, `(() => { const o = JSON.parse(${JSON.stringify(from.dump)}); for (const k in o) localStorage.setItem(k, o[k]); })()`);
await send("Page.navigate", { url: TO + "/" }, b.s); await sleep(9000);
const to = await ev(b.s, "location.pathname");
await b.close();
console.log(JSON.stringify({ from: FROM, to: TO, loggedIn: to === "/" }));
process.exit(to === "/" ? 0 : 2);
