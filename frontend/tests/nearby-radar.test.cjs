/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **레이더 배치** (S15P21A405-496).
 *
 * 화면으로만 보면 "대충 맞아 보인다" 로 끝나는 종류라 숫자로 고정한다. 특히 겹침은 사람 수가
 * 어떤 값일 때만 터지는데, 그 한 경우를 눈으로 잡기 어렵다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { angleOf, radiusOf, sizeOf } = require("../src/components/panels/friends/nearby-radar.tsx");
const { RADAR } = require("../src/constants/realtime.ts");

test("가까운 사람이 안쪽, 먼 사람이 바깥이다", () => {
  assert.ok(radiusOf(0, 10) < radiusOf(5, 10));
  assert.ok(radiusOf(5, 10) < radiusOf(10, 10));
  // 부동소수라 정확히 같지는 않다 — ringMin + 1*(ringMax-ringMin) 이 ringMax 와 미세하게 어긋난다
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(radiusOf(0, 10), RADAR.ringMin), "가장 가까워도 가운데(나)와는 떨어져 있다");
  assert.ok(near(radiusOf(10, 10), RADAR.ringMax));
});

test("거리를 모르면(최대 0) 전부 같은 고리에 둔다 — 없는 차이를 지어내지 않는다", () => {
  assert.equal(radiusOf(0, 0), RADAR.ringMin);
});

test("만남 횟수가 전부 0이거나 전부 같으면 크기가 균일하다", () => {
  assert.equal(sizeOf(0, 0), RADAR.sizeMin, "집계가 안 오면 모두 최소 크기");
  assert.equal(sizeOf(3, 3), RADAR.sizeMax, "한 명뿐이면 그 사람이 최대값이다");
});

test("자주 마주친 사람이 크다", () => {
  assert.ok(sizeOf(1, 10) < sizeOf(5, 10));
  assert.ok(sizeOf(5, 10) < sizeOf(10, 10));
});

test("사람이 몇 명이든 고르게 나뉜다 — 간격이 전부 같다", () => {
  for (const n of [1, 2, 3, 5, 7, 10]) {
    const gaps = [];
    for (let i = 1; i < n; i++) gaps.push(angleOf(i, n) - angleOf(i - 1, n));
    const uniq = new Set(gaps.map((g) => g.toFixed(9)));
    assert.equal(uniq.size <= 1, true, `${n}명에서 간격이 갈렸다: ${[...uniq]}`);
  }
});

test("가장 먼 고리에 최대 인원이 서도 헬멧이 서로 겹치지 않는다", () => {
  const n = 10; // realtime.nearby.neighbor-k
  const R = RADAR.size / 2;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = angleOf(i, n);
    // 최악은 전부 같은 고리에 있을 때다 — 가장 안쪽 고리가 둘레가 짧아 제일 빡빡하다
    const r = RADAR.ringMin * R;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  let min = Infinity;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
  assert.ok(min > RADAR.sizeMax, `가장 가까운 두 헬멧 간격 ${min.toFixed(1)}px 가 최대 지름 ${RADAR.sizeMax}px 보다 좁다`);
});
