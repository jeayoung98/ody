/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **따라가기 중에도 인솔자와 동승자가 반응을 주고받는다** (S15P21A405-699).
 *
 * 동승자는 지도에 올라가지 않는다 — 인솔자의 주변 목록에도 없고 지도 표식도 없다. 그래서 인솔자가 보낸 반응은
 * 동승자에게 안 갔고, 동승자가 보낸 반응은 인솔자에게 가도 띄울 자리가 없어 숨겨졌다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reactionRecipients } = require("../src/lib/realtime/reaction-recipients.ts");
const { drawQueue } = require("../src/components/map/render/draw-friends.ts");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

function anyCtx() {
  const noop = () => {};
  const target = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
}
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => anyCtx() }) };
global.Image = class {
  set src(_v) {}
};
const rider = (email) => ({ email, nickname: email.split("@")[0], imageUrl: null, avatarSeed: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], genreId: 1 });

test("인솔자면 동승자도 받는다", () => {
  assert.deepEqual(reactionRecipients([{ email: "n@x" }], null, [{ email: "r1@x" }, { email: "r2@x" }]), ["n@x", "r1@x", "r2@x"]);
});

test("동승자면 인솔자가 받는다 — 주변 목록이 비어 있어도", () => {
  assert.deepEqual(reactionRecipients([], "leader@x", []), ["leader@x"]);
});

test("같은 사람은 한 번만 — 두 번 보내면 두 번째가 쿨다운에 걸린다", () => {
  assert.deepEqual(reactionRecipients([{ email: "leader@x" }], "leader@x", []), ["leader@x"]);
});

test("따라가기가 아니면 주변 사람 그대로다", () => {
  assert.deepEqual(reactionRecipients([{ email: "a@x" }, { email: "b@x" }], null, []), ["a@x", "b@x"]);
});

test("우주선 뒤 줄을 그리면 동승자마다 헬멧 자리를 적는다", () => {
  const out = new Map();
  drawQueue(anyCtx(), 400, 300, 13, 0, 0, { me: null, riders: [rider("r1@x"), rider("r2@x")], count: 2 }, out);
  assert.equal(out.size, 2);
  const a = out.get("r1@x");
  const b = out.get("r2@x");
  assert.ok(a.y > 300 && b.y > a.y, `줄은 우주선 뒤(아래)로 차례대로 선다 ${a.y} ${b.y}`);
});

test("다섯 명을 넘으면 접힌 사람은 +N 자리를 받는다", () => {
  const out = new Map();
  const riders = Array.from({ length: 7 }, (_, i) => rider(`r${i}@x`));
  drawQueue(anyCtx(), 400, 300, 13, 0, 0, { me: null, riders, count: 7 }, out);
  assert.equal(out.size, 7);
  assert.deepEqual(out.get("r5@x"), out.get("r6@x"), "접힌 둘은 같은 동그라미");
});

test("지도 표식이 없는 동승자의 반응 자리는 우주선 뒤 헬멧이다", () => {
  const e = new MapEngine();
  e.myQueueScreen.set("r1@x", { x: 10, y: 20 });
  e.myRiderUsers = [rider("r1@x")];
  assert.deepEqual(e.friendScreenPos("r1@x"), { x: 10, y: 20 });
  assert.equal(e.friendNickname("r1@x"), "r1");
  assert.equal(e.friendScreenPos("nobody@x"), null, "모르는 사람은 여전히 숨긴다");
});
