/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **따라가는 동안 내 반응은 내 헬멧에서 떠오른다** (S15P21A405-698).
 *
 * 따라갈 때 나는 인솔자 우주선 뒤 "나" 칸의 헬멧이다. 반응 자리를 지도 표식(`me`)으로 잡으면 엉뚱한 데서 떠올랐다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { drawQueue } = require("../src/components/map/render/draw-friends.ts");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

/** 무엇을 불러도 받아 주는 가짜 캔버스 — 그림 결과는 안 보고 돌려주는 자리만 본다 */
function anyCtx() {
  const noop = () => {};
  const target = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : noop), set: () => true });
}

const me = { email: "me@x", nickname: "나", imageUrl: null, avatarSeed: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], genreId: 1 };

// 얼굴 그림(`drawVisor`)이 캔버스를 만들어 굽는다 — 노드에는 DOM 이 없으니 받아 주기만 하는 가짜를 둔다
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => anyCtx() }) };
global.Image = class {
  set src(_v) {}
};

test('"나" 칸을 그리면 그 화면 자리를 돌려준다 — 우주선 뒤쪽이다', () => {
  const at = drawQueue(anyCtx(), 400, 300, 13, 0, 0, { me, riders: [], count: 0 });
  assert.ok(at, "자리가 있어야 한다");
  // 기수가 위(ang 0)면 줄은 아래로 선다 — 우주선보다 아래에 있어야 한다
  assert.ok(at.y > 300, `y ${at.y}`);
});

test('"나" 가 줄에 없으면(인솔자 쪽 화면) null 이다', () => {
  assert.equal(drawQueue(anyCtx(), 400, 300, 13, 0, 0, { me: null, riders: [], count: 2 }), null);
});

test("따라가는 동안 반응 자리는 헬멧 자리다 — 지도 표식 자리가 아니다", () => {
  const e = new MapEngine();
  e.follow = { leader: { email: "leader@x" } };
  e.rideMeScreen = { x: 123, y: 456 };
  assert.deepEqual(e.mePos(), { x: 123, y: 456 });
  e.rideMeScreen = null;
  assert.equal(e.mePos(), null, "헬멧이 안 그려졌으면(인솔자가 화면 밖) 숨긴다");
});

test("혼자일 때는 예전처럼 지도 표식 자리다", () => {
  const e = new MapEngine();
  e.follow = null;
  e.myId = 1;
  e.me = { x: 0, y: 0 };
  e.rideMeScreen = { x: 999, y: 999 };
  const p = e.mePos();
  assert.ok(p && p.x !== 999, "헬멧 자리를 쓰면 안 된다");
});
