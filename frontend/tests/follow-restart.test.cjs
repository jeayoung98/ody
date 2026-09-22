/* eslint-disable @typescript-eslint/no-require-imports */
// 따라가기를 언제 다시 거는가 (S15P21A405-559).
// 잘못 걸면 우주선이 제자리에 멈춘다 — 화면은 옮겨가서 "되는 것처럼" 보이는 종류의 고장이다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shouldRestartFollow } = require("../src/components/map/engine/follow-restart.ts");

const here = { email: "a@x.com", layer: 0 };

test("아직 아무도 안 따라가면 건다", () => {
  assert.equal(shouldRestartFollow(null, here), true);
});

/**
 * **이 줄이 이 파일의 이유다.** 곡이 바뀔 때마다 다시 걸면 `rideTo` 가 방금 건 비행이
 * 취소돼서 우주선이 안 움직인다. 같은 사람·같은 겹이면 건드리지 않는다.
 */
test("같은 사람을 같은 겹에서 따라가는 중이면 다시 걸지 않는다", () => {
  assert.equal(shouldRestartFollow(here, { ...here }), false);
});

test("사람이 바뀌면 다시 건다", () => {
  assert.equal(shouldRestartFollow(here, { email: "b@x.com", layer: 0 }), true);
});

test("겹이 바뀌면 다시 건다 — 좌표계가 겹마다 다르다", () => {
  assert.equal(shouldRestartFollow(here, { email: "a@x.com", layer: 1 }), true);
});
