/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 진행바 가짜 파형의 높이 (S15P21A405-428 · 456).
 *
 * 상한이 지켜지는지가 핵심이다 — 헤드 근처 바는 CSS 로 1.5배 늘어나므로 MAX_H 가 66% 를
 * 넘으면 상자를 넘쳐 잘린다. MIN_H·CONTRAST 를 손볼 때 그 선을 넘기기 쉽다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shapeFor, MIN_H, MAX_H } = require("../src/components/player/waveform-bars.tsx");

const SEEDS = [0, 1, 7, 42, 1234, 99999, 777777];
const all = SEEDS.flatMap((s) => shapeFor(s));

test("모든 바가 바닥과 상한 사이에 있다", () => {
  assert.equal(Math.min(...all) >= Math.round(MIN_H * 100), true);
  assert.equal(Math.max(...all) <= Math.round(MAX_H * 100), true);
});

test("가장 높은 바가 1.5배로 흔들려도 상자를 넘지 않는다", () => {
  assert.equal(Math.max(...all) * 1.5 <= 100, true);
});

test("같은 곡은 항상 같은 모양이다 — 새로고침해도 안 바뀐다", () => {
  assert.deepEqual(shapeFor(42), shapeFor(42));
  assert.notDeepEqual(shapeFor(42), shapeFor(43));
});

test("높이가 한 덩어리에 몰려 있지 않다 — 낮은 바와 높은 바가 갈라진다", () => {
  const sorted = [...all].sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  // 예전 공식의 사분위 간격은 18pt 였다 (35~53). 그보다 넓어야 파형으로 읽힌다
  assert.equal(q(0.75) - q(0.25) > 18, true);
  // 바닥에 실제로 닿는 바가 있어야 한다 — 아니면 MIN_H 를 내린 의미가 없다
  assert.equal(q(0.02) < 15, true);
});
