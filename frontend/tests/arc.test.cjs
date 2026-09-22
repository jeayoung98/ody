/* eslint-disable @typescript-eslint/no-require-imports */
// 지도에서 무언가가 자리를 옮길 때 그리는 곡선 (S15P21A405-553).
// 눈으로는 "휘긴 하네" 밖에 못 본다 — 끝점이 정확한지, 방향이 맞는지는 수치로 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { arcBetween, atArc } = require("../src/components/map/engine/arc.ts");

const T0 = 1000;
const from = { x: 0, y: 0 };
const to = { x: 10, y: 0 };
const arc = () => arcBetween(from, to, T0, 500, 0.28, 1);

test("출발점에서 출발하고 도착점에서 끝난다", () => {
  const a = arc();
  const start = atArc(a, T0);
  const end = atArc(a, T0 + 500);

  assert.equal(start.x, 0);
  assert.equal(start.y, 0);
  assert.equal(end.t, 1);
  // 끝이 어긋나면 표식이 별에서 비껴 선다 — 제일 눈에 띄는 고장이다
  assert.ok(Math.abs(end.x - 10) < 1e-9, `도착 x 가 ${end.x}`);
  assert.ok(Math.abs(end.y) < 1e-9, `도착 y 가 ${end.y}`);
});

test("가는 길은 직선에서 벗어난다 — 그게 '날아간다' 로 보이는 이유다", () => {
  const mid = atArc(arc(), T0 + 250);
  assert.ok(Math.abs(mid.y) > 0.5, `가운데가 직선 위에 있다 (y=${mid.y})`);
});

test("휘는 쪽을 정할 수 있고, 반대로 주면 반대로 휜다", () => {
  const up = atArc(arcBetween(from, to, T0, 500, 0.28, 1), T0 + 250);
  const down = atArc(arcBetween(from, to, T0, 500, 0.28, -1), T0 + 250);
  assert.ok(up.y * down.y < 0, "같은 쪽으로 휘면 늘 같은 길로만 다니는 것처럼 보인다");
});

/** 고정값으로 휘게 두면 가까운 이동이 우스꽝스럽게 꺾인다 */
test("휘는 정도가 거리에 비례한다", () => {
  const near = atArc(arcBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, T0, 500, 0.28, 1), T0 + 250);
  const far = atArc(arcBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, T0, 500, 0.28, 1), T0 + 250);
  assert.ok(Math.abs(far.y) > Math.abs(near.y) * 50, `가까운 ${near.y} / 먼 ${far.y}`);
});

test("진행 방향은 대체로 목적지 쪽이다 — 헬멧 기수가 그걸 본다", () => {
  const a = arc();
  // 가운데를 지날 때는 이미 목적지 쪽으로 돌아서 있어야 한다
  const h = atArc(a, T0 + 250).heading;
  assert.ok(Math.abs(h) < Math.PI / 2, `가운데에서 뒤를 보고 있다 (heading=${h})`);
});

test("시간 밖을 물어도 구간 안으로 잘린다", () => {
  const a = arc();
  assert.equal(atArc(a, T0 - 9999).t, 0, "출발 전이면 출발점");
  assert.equal(atArc(a, T0 + 9999).t, 1, "지난 뒤면 도착점");
});

test("제자리 이동도 터지지 않는다 — 0 으로 나누는 자리가 있다", () => {
  const same = arcBetween({ x: 3, y: 4 }, { x: 3, y: 4 }, T0, 500, 0.28, 1);
  const p = atArc(same, T0 + 250);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.heading));
});

test("시간이 0 이어도 나눗셈이 깨지지 않는다", () => {
  const p = atArc(arcBetween(from, to, T0, 0, 0.28, 1), T0);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.t));
});
