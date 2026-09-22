/* eslint-disable @typescript-eslint/no-require-imports */
// 지도 위 사람 표식 배치를 언제 다시 정하는가 (S15P21A405-566).
// 재활용 판단이 느슨하면 없는 사람이 남거나 새로 온 사람이 아예 안 그려진다 — 둘 다 화면에
// 아무 표시도 안 남는 고장이라 수치로 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reusablePlan } = require("../src/components/map/engine/friend-plan.ts");

const plan = [
  { marker: "a", stacked: ["b", "c"] },
  { marker: "d", stacked: [] },
];
const setOf = (...xs) => new Set(xs);

test("명단이 그대로면 지난 배치를 다시 쓴다", () => {
  const got = reusablePlan(plan, setOf("a", "b", "c", "d"));
  assert.deepEqual(got, plan);
  assert.notEqual(got, plan, "사본을 준다 — 부르는 쪽이 고쳐도 원본이 안 상한다");
});

test("아직 배치가 없으면 새로 정한다", () => {
  assert.equal(reusablePlan(null, setOf("a")), null);
});

/** 빠진 사람을 그대로 그리면 없는 사람이 화면에 남는다 */
test("한 명이라도 나가면 다시 정한다", () => {
  assert.equal(reusablePlan(plan, setOf("a", "b", "d")), null, "묶여 있던 c 가 나갔다");
  assert.equal(reusablePlan(plan, setOf("b", "c", "d")), null, "대표였던 a 가 나갔다");
});

/** 새로 온 사람이 배치에 없으면 아예 안 그려진다 */
test("한 명이라도 들어오면 다시 정한다", () => {
  assert.equal(reusablePlan(plan, setOf("a", "b", "c", "d", "e")), null);
});

test("아무도 없으면 빈 배치를 그대로 쓴다", () => {
  assert.deepEqual(reusablePlan([], setOf()), []);
  assert.equal(reusablePlan([], setOf("a")), null, "없던 사람이 생겼다");
});
