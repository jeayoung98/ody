/* eslint-disable @typescript-eslint/no-require-imports */
// 내 자리 판정과 돌아가는 길 (S15P21A405-670). 겹 l 은 pc[2l]·pc[2l+1] 평면이고 파고들 때마다 사각형이 쌓인다 —
// 틀리면 최상단에서도 내 별이 "다른 갈래" 로 뜨거나, 내 위치로 가기가 엉뚱한 겹까지 떠오른다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { insideBoxes, firstMismatch, sharedDepth, homeRoute } = require("../src/components/map/engine/my-place.ts");

const box = (layer, xMin, xMax, yMin, yMax) => ({ layer, xMin, xMax, yMin, yMax });
const pc = [0.5, 0.5, 2, 2, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

test("최상단은 사각형이 없어 어떤 곡이든 있다", () => {
  assert.equal(insideBoxes(pc, [], 0), true);
  assert.equal(firstMismatch(pc, [], 0), null);
});

test("겹마다 그 겹의 두 축으로 판정하고, 처음 벗어난 겹을 알려 준다", () => {
  const path = [box(0, 0, 1, 0, 1), box(1, 1, 3, 1, 3)];
  assert.equal(insideBoxes(pc, path, 2), true, "1겹 (0.5,0.5) · 2겹 (2,2) 둘 다 안");
  const other = [box(0, 0, 1, 0, 1), box(1, 5, 6, 5, 6)];
  assert.equal(insideBoxes(pc, other, 2), false);
  assert.equal(firstMismatch(pc, other, 2), 1, "2겹에서 갈렸다");
  assert.equal(insideBoxes(pc, other, 1), true, "1겹까지만 보면 같은 갈래");
  assert.equal(firstMismatch(pc, [box(0, 2, 3, 2, 3)], 1), 0);
});

test("같은 갈래 길이 — 앞에서부터 같은 사각형 수", () => {
  const a = [box(0, 0, 1, 0, 1), box(1, 1, 3, 1, 3), box(2, 0, 1, 0, 1)];
  const b = [box(0, 0, 1, 0, 1), box(1, 5, 6, 5, 6)];
  assert.equal(sharedDepth(a, b), 1);
  assert.equal(sharedDepth(a, a), 3);
  assert.equal(sharedDepth([], b), 0);
});

test("돌아가는 길은 갈리는 겹까지만 떠오르고 거기서부터 재생 때 사각형을 따라 내려간다", () => {
  const home = [box(0, 0, 1, 0, 1), box(1, 1, 3, 1, 3), box(2, 0, 1, 0, 1)]; // 3겹에서 재생
  const now = [box(0, 0, 1, 0, 1), box(1, 5, 6, 5, 6)]; // 최상단에서 다른 쪽으로 2겹까지
  const r = homeRoute(now, home);
  assert.equal(r.riseTo, 1, "1겹까지만 떠오른다 — 우주(0)까지 안 간다");
  assert.deepEqual(r.dives, home.slice(1), "거기서 두 겹을 다시 파고든다");
  assert.deepEqual(homeRoute(home, home), { riseTo: 3, dives: [] }, "같은 자리면 갈 길이 없다");
  assert.deepEqual(homeRoute(home.slice(0, 1), home), { riseTo: 1, dives: home.slice(1) }, "위 겹에 있으면 떠오르지 않고 파고들기만");
  assert.deepEqual(homeRoute(home, home.slice(0, 1)), { riseTo: 1, dives: [] }, "아래 겹에 있으면 떠오르기만");
});
