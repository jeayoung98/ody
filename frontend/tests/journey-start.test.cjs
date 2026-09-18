/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 여정 출발점 자동 채우기 (JOURNEY-01 · S15P21A405-437).
 *
 * 곡 상세의 `도착점으로` 한 번으로 경로가 서야 한다. 다만 이미 있는 출발을 덮어쓰거나
 * 출발·도착을 같은 곡으로 만들면, `경로 만들기` 가 왜 안 눌리는지 모르는 상태가 된다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { journeyStartFor } = require("../src/hooks/use-open-journey-composer.ts");

test("출발이 비었고 듣는 곡이 있으면 그 곡이 출발이 된다 — 도착점으로 한 번에 경로가 선다", () => {
  assert.equal(journeyStartFor(null, 20, 7), 7);
});

test("출발이 이미 있으면 손대지 않는다 — 출발점으로 가 넣은 곡을 덮지 않는다", () => {
  assert.equal(journeyStartFor(5, null, 7), null);
  assert.equal(journeyStartFor(5, 20, 7), null);
});

test("듣는 곡이 없으면 손대지 않는다 — 기존대로 첫 클릭이 출발이다", () => {
  assert.equal(journeyStartFor(null, 20, null), null);
});

test("듣는 곡이 도착과 같으면 채우지 않는다 — 같은 두 지점으로는 경로가 안 선다", () => {
  assert.equal(journeyStartFor(null, 7, 7), null);
});
