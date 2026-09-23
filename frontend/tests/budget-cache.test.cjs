/* eslint-disable @typescript-eslint/no-require-imports */
// 예산으로 재는 LRU 캐시 (S15P21A405-586).
//
// 커버 캐시가 개수로 재다가 넘치면 통째로 비웠다. 104px 한 장은 43KB 인데 곡 상세 배경의
// 512px 은 1MB 라 개수는 아무것도 막아 주지 못했고, 비울 때는 지금 화면에 서 있는 커버까지
// 같이 날아가 가장 바쁜 순간에 다시 받게 했다. 여기서 지키는 것은 그 둘이다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { BudgetCache, canvasBytes } = require("../src/lib/budget-cache.ts");

/** 캔버스 흉내 — 실제로 재는 것은 넓이 × 4 다 */
const canvas = (side) => ({ width: side, height: side });

test("예산을 넘으면 가장 오래 안 쓴 것부터 나간다", () => {
  const cache = new BudgetCache(300, (v) => v.cost);
  cache.set("a", { cost: 100 });
  cache.set("b", { cost: 100 });
  cache.set("c", { cost: 100 });
  cache.set("d", { cost: 100 });

  assert.equal(cache.get("a"), undefined, "가장 먼저 넣은 것이 나간다");
  assert.ok(cache.get("d"), "방금 넣은 것은 남는다");
  assert.ok(cache.bytes <= 300);
});

/** 이 한 줄이 LRU 를 만든다 — 꺼내 쓴 것은 다시 최근 것이 된다 */
test("꺼내 쓰면 다시 최근 것이 되어 살아남는다", () => {
  const cache = new BudgetCache(300, (v) => v.cost);
  cache.set("a", { cost: 100 });
  cache.set("b", { cost: 100 });
  cache.set("c", { cost: 100 });
  cache.get("a");
  cache.set("d", { cost: 100 });

  assert.ok(cache.get("a"), "다시 쓴 것은 남는다");
  assert.equal(cache.get("b"), undefined, "그 다음으로 오래된 것이 나간다");
});

/** 후보를 훑는 것은 쓴 것이 아니다 — 여기서 순서가 흔들리면 지도가 훑을 때마다 순서가 뒤집힌다 */
test("has 는 순서를 건드리지 않는다", () => {
  const cache = new BudgetCache(200, (v) => v.cost);
  cache.set("a", { cost: 100 });
  cache.set("b", { cost: 100 });
  cache.has("a");
  cache.set("c", { cost: 100 });

  assert.equal(cache.get("a"), undefined, "훑기만 한 것은 여전히 가장 오래된 것이다");
});

/** 예산보다 큰 한 장이 들어와도 그것만은 서 있어야 한다 — 아니면 부르는 쪽이 영원히 다시 만든다 */
test("예산보다 큰 것을 넣어도 그 한 장은 남는다", () => {
  const cache = new BudgetCache(100, (v) => v.cost);
  cache.set("a", { cost: 50 });
  cache.set("big", { cost: 999 });

  assert.ok(cache.get("big"));
  assert.equal(cache.size, 1);
});

test("같은 키를 덮어쓰면 크기를 두 번 세지 않는다", () => {
  const cache = new BudgetCache(1000, (v) => v.cost);
  cache.set("a", { cost: 100 });
  cache.set("a", { cost: 40 });

  assert.equal(cache.size, 1);
  assert.equal(cache.bytes, 40);
});

test("캔버스 크기는 픽셀당 4바이트다", () => {
  assert.equal(canvasBytes(canvas(104)), 104 * 104 * 4);
  // 지도 커버와 곡 상세 배경이 24배 차이 난다 — 개수로 재면 뜻이 없다는 근거
  assert.equal(Math.round(canvasBytes(canvas(512)) / canvasBytes(canvas(104))), 24);
});
