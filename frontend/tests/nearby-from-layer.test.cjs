/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **주변 사람 목록의 거리와 순서** (S15P21A405-541 · 582).
 *
 * 예전에는 여기서 "가까운 사람만" 을 골라냈다. 5차에서 서버가 층 전체를 기준으로 삼고 가까운
 * 순으로 잘라 주게 되면서 그 자르기를 걷어냈고, 남은 것은 **거리를 재는 일**과 **합친 뒤
 * 상한까지 자르는 일** 둘뿐이다.
 *
 * 틀려도 화면에 오류가 안 난다. 목록 순서가 조금 이상하거나 모르는 사람이 맨 앞에 올 뿐이라,
 * 눈으로는 무엇이 잘못됐는지 말할 수 없다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { distanceBetween, distanceFrom, nearestFirst, radiusFromNeighbors, withinRadius } = require("../src/lib/nearby-from-layer.ts");

test("두 점 사이 거리", () => {
  assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(distanceBetween({ x: 1, y: 1 }, { x: 1, y: 1 }), 0);
});

/**
 * 잴 수 없으면 무한대다. 0 으로 채우면 **모르는 사람이 제일 가까운 사람으로** 올라온다.
 * 내가 아직 아무 곡도 안 틀었을 때와, 그 사람 자리를 서버도 지도도 모를 때가 그렇다.
 */
test("잴 수 없으면 맨 뒤로 보낸다", () => {
  assert.equal(distanceFrom(null, { x: 1, y: 1 }), Number.POSITIVE_INFINITY);
  assert.equal(distanceFrom({ x: 0, y: 0 }, null), Number.POSITIVE_INFINITY);
  assert.equal(distanceFrom(null, null), Number.POSITIVE_INFINITY);
});

test("잴 수 있으면 그대로 잰다", () => {
  assert.equal(distanceFrom({ x: 0, y: 0 }, { x: 0, y: 2 }), 2);
  // 같은 곡을 듣는 사람은 거리가 0 이다 — 레이더에서 내 자리에 겹친다
  assert.equal(distanceFrom({ x: 5, y: -3 }, { x: 5, y: -3 }), 0);
});

const person = (email, distance) => ({ email, distance });

test("가까운 순으로 정렬한다", () => {
  const out = nearestFirst([person("c", 3), person("a", 1), person("b", 2)], 10);
  assert.deepEqual(
    out.map((p) => p.email),
    ["a", "b", "c"],
  );
});

/**
 * **상한이 한 군데뿐이다.** 출처가 셋이라(서버 목록·겹 조회·봇) 각자 자르면 합친 결과가
 * 상한을 넘는다. 서버도 가까운 순으로 자르므로 같은 기준을 한 번 더 건다.
 */
test("상한까지만 남긴다 — 먼 사람이 먼저 잘린다", () => {
  const out = nearestFirst([person("far", 9), person("near", 1), person("mid", 5)], 2);
  assert.deepEqual(
    out.map((p) => p.email),
    ["near", "mid"],
  );
});

test("잴 수 없던 사람은 상한에서 먼저 잘린다", () => {
  const out = nearestFirst([person("unknown", Number.POSITIVE_INFINITY), person("near", 1)], 1);
  assert.deepEqual(
    out.map((p) => p.email),
    ["near"],
  );
});

test("상한이 사람 수보다 크면 다 남는다", () => {
  assert.equal(nearestFirst([person("a", 1), person("b", 2)], 12).length, 2);
});

test("상한이 0 이하면 아무도 안 남는다", () => {
  assert.deepEqual(nearestFirst([person("a", 1)], 0), []);
});

/** 원본을 건드리지 않는다 — 호출부가 같은 배열을 다시 쓴다 */
test("넘겨받은 배열을 제자리에서 정렬하지 않는다", () => {
  const input = [person("c", 3), person("a", 1)];
  nearestFirst(input, 10);
  assert.equal(input[0].email, "c");
});

/**
 * **"가깝다" 의 경계를 그 겹의 곡 분포에서 뽑는다** (S15P21A405-541).
 * 고정 숫자를 박으면 겹마다 축의 퍼짐이 달라 한 겹에서는 아무도 안 뜨고 다른 겹에서는 다 뜬다.
 */
test("내 곡에서 k 번째로 가까운 곡까지가 경계다", () => {
  assert.equal(radiusFromNeighbors([5, 1, 3, 2, 4], 3), 3);
  assert.equal(radiusFromNeighbors([5, 1, 3, 2, 4], 1), 1);
});

test("곡이 k 개보다 적으면 있는 것 중 제일 먼 곡까지다", () => {
  assert.equal(radiusFromNeighbors([2, 1], 80), 2);
});

test("곡이 하나도 없으면 0 — 아무도 안 들어온다", () => {
  assert.equal(radiusFromNeighbors([], 80), 0);
  assert.deepEqual(withinRadius([person("a", 1)], 0), []);
});

/**
 * **인원을 채우지 않는다** (S15P21A405-596). 서버 상한은 열두 명을 채우는 값이라 사람이 적은
 * 층에서 층 반대편 사람까지 넣어 준다. 경계를 걸어야 "주변 사람" 이 제 뜻을 갖는다.
 */
test("경계 밖 사람은 뺀다 — 자리가 남아도 안 채운다", () => {
  const out = withinRadius([person("near", 1), person("far", 100)], 10);
  assert.deepEqual(
    out.map((p) => p.email),
    ["near"],
  );
});

test("경계 위에 딱 걸치면 넣는다", () => {
  assert.equal(withinRadius([person("edge", 10)], 10).length, 1);
});

test("가까이 아무도 없으면 빈 목록 — 그게 사실이다", () => {
  assert.deepEqual(withinRadius([person("far", 999)], 10), []);
});

/** 내 자리를 모르면 거리를 잴 기준이 없다. 그때 넣어 두면 "가깝다" 가 아무 뜻이 없어진다 */
test("경계를 모르면 아무도 안 넣는다", () => {
  assert.deepEqual(withinRadius([person("a", 1)], null), []);
});

test("잴 수 없던 사람은 경계에서 걸러진다", () => {
  assert.deepEqual(withinRadius([person("unknown", Number.POSITIVE_INFINITY)], 10), []);
});
