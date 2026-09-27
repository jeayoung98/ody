/* eslint-disable @typescript-eslint/no-require-imports */
// 늦게 도착한 옛 자리를 거르는가 (S15P21A405-565).
// 소켓 왕복 몇백 ms 안에서만 벌어지는 일이라 눈으로는 "가끔 화면이 튄다" 로만 보인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { acceptsAnchor } = require("../src/components/map/engine/stale-anchor.ts");

test("날아가는 중이 아니면 서버가 준 자리를 그대로 받는다", () => {
  // 따라가기(RIDE_TRACK)·하차가 이 길이다. 그때는 서버 값이 유일한 근거다
  assert.equal(acceptsAnchor(null, 100), true);
  assert.equal(acceptsAnchor(null, 999), true);
});

test("날아가는 중이면 그 목적지와 같을 때만 받는다", () => {
  assert.equal(acceptsAnchor(200, 200), true, "도착 확인은 받는다");
  assert.equal(acceptsAnchor(200, 100), false, "직전 곡을 실어 온 옛 답은 버린다");
});

/**
 * **비행이 끝나면 다시 평소대로다.** `travelToId` 는 도착할 때 null 이 되므로,
 * 그 뒤에 오는 자리는 거르지 않는다 — 안 그러면 따라가기가 영영 자리를 못 잡는다.
 */
test("비행이 끝난 뒤에는 무엇이 와도 받는다", () => {
  assert.equal(acceptsAnchor(null, 100), true);
});
