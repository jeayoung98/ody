/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 진행바 가짜 파형의 높이 (S15P21A405-428 · 456).
 *
 * 상한이 지켜지는지가 핵심이다 — 헤드 근처 바는 CSS 로 1.5배 늘어나므로 MAX_H 가 66% 를
 * 넘으면 상자를 넘쳐 잘린다. MIN_H·CONTRAST 를 손볼 때 그 선을 넘기기 쉽다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shapeFor, barHeight, MIN_H, MAX_H } = require("../src/components/player/waveform-bars.tsx");

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

/**
 * 지나온 구간의 자취 (S15P21A405-464). 460 에서 헤드 근처를 뺀 전부를 눕혔다가,
 * 어디까지 들었는지가 얇은 줄 하나로만 남아 되세운 자리다 — 또 눕지 않게 여기서 지킨다.
 */
test("지나온 바는 제 높이로 서 있고 안 지나간 바는 눕는다", () => {
  const h = 60;
  const head = 30;
  // 지나온 자리 — 헤드에서 멀어도 선 채로 남는다
  assert.equal(barHeight(h, 0, head, true), h);
  assert.equal(barHeight(h, head - 1, head, true), h);
  // 아직 안 지나간 자리 — 헤드 근처 흔들림 범위 밖은 눕는다
  assert.equal(barHeight(h, head + 20, head, true) < h, true);
});

test("멈춰 있어도 지나온 구간은 서 있다 — 자취는 재생 여부와 상관없다", () => {
  const h = 60;
  assert.equal(barHeight(h, 5, 30, false), h);
  assert.equal(barHeight(h, 50, 30, false) < h, true);
});
