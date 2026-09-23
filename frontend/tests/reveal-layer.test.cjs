/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **검색한 곡을 보여 주려면 어느 겹으로 올라가야 하는가** (S15P21A405-581).
 *
 * 틀리면 조용히 엉뚱한 겹에 내려놓고, 그 겹에 그 곡이 없으니 화면에는 아무것도 안 뜬다.
 * 눌렀는데 아무 일도 안 나는 것으로만 보여서 눈으로는 못 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { nearestLayerWith } = require("../src/components/map/engine/reveal-layer.ts");

/** 겹 번호와 "그 겹에 이 곡이 있나" 만 있으면 된다 */
const frame = (layer, has) => ({ layer, subset: has });

test("여러 겹에 있으면 가장 깊은 겹을 고른다 — 필요한 만큼만 올라간다", () => {
  // 곡 색인 2 가 겹 0 과 겹 2 에 있다. 지금 겹 3 에서 올라간다면 2 가 가장 가깝다
  const frames = [frame(0, [0, 0, 1]), frame(1, [0, 0, 0]), frame(2, [0, 0, 1])];
  assert.equal(nearestLayerWith(frames, 2), 2);
});

test("한 겹에만 있으면 그 겹이다", () => {
  assert.equal(nearestLayerWith([frame(0, [1]), frame(1, [0])], 0), 0);
});

/**
 * 어느 겹에도 없으면 부르는 쪽이 최상위로 올려 그 자리에 끼워 넣는다. 서버가 주는 상주 집합은
 * 겹마다 top-k 라, 카탈로그에 있는 곡도 어느 집합에도 안 들 수 있다.
 */
test("어느 겹에도 없으면 null 이다", () => {
  assert.equal(nearestLayerWith([frame(0, [0]), frame(1, [0])], 0), null);
});

test("파고든 적이 없으면 볼 프레임이 없다", () => {
  assert.equal(nearestLayerWith([], 0), null);
});

/**
 * 곡을 새로 편입(adopt)하면 색인이 뒤에 붙는데, 그 전에 쌓인 프레임의 마스크는 그만큼 짧다.
 * 그 곡은 애초에 어느 겹의 top-k 에도 없던 곡이라 "없음" 이 맞는 답이다.
 */
test("마스크가 색인보다 짧으면 없는 것으로 읽는다", () => {
  assert.equal(nearestLayerWith([frame(0, [1, 1])], 7), null);
});

test("프레임 순서가 뒤섞여도 답이 같다", () => {
  const shuffled = [frame(2, [1]), frame(0, [1]), frame(1, [0])];
  assert.equal(nearestLayerWith(shuffled, 0), 2);
});
