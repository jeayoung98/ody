/* eslint-disable @typescript-eslint/no-require-imports */
// 우주선 기수가 튀지 않고 돌아간다 (S15P21A405-709).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ShipTurn, shortestTurn } = require("../src/components/map/engine/ship-turn.ts");

test("처음 보는 우주선은 목표 각도에 바로 선다", () => {
  const s = new ShipTurn();
  assert.equal(s.step("a", 1, 0), 1);
});

test("목표가 바뀌면 한 번에 튀지 않고 서서히 돈다", () => {
  const s = new ShipTurn();
  s.step("a", 0, 0);
  const mid = s.step("a", Math.PI / 2, 16);
  assert.ok(mid > 0 && mid < Math.PI / 2);
  let ang = mid;
  for (let t = 32; t <= 400; t += 16) ang = s.step("a", Math.PI / 2, t);
  assert.ok(Math.abs(ang - Math.PI / 2) < 0.01);
});

test("목표가 없으면 마지막 각도를 유지한다", () => {
  const s = new ShipTurn();
  s.step("a", 2, 0);
  assert.equal(s.step("a", null, 16), 2);
  assert.equal(s.step("a", null, 400), 2);
});

test("짧은 쪽으로 돈다", () => {
  assert.ok(Math.abs(shortestTurn(0.1, Math.PI * 2 - 0.1) + 0.2) < 1e-9);
  assert.ok(Math.abs(shortestTurn(Math.PI * 2 - 0.1, 0.1) - 0.2) < 1e-9);
});

test("오래 안 그려졌다가 나오면 도는 연출 없이 바로 선다", () => {
  const s = new ShipTurn();
  s.step("a", 0, 0);
  assert.equal(s.step("a", 1, 2000), 1);
});
