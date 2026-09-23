/* eslint-disable @typescript-eslint/no-require-imports */
// 지도 상주 집합 캐시의 상한 (S15P21A405-586).
//
// `gcTime: Infinity` 는 오르내리는 길이 끊기지 않게 하려는 것이었는데, 캐시 키가 누적 범위라
// 새 경로로 좁혀 들어갈 때마다 키가 늘고 세션 내내 하나도 안 버렸다. 상한을 걸되 **지금 보고
// 있는 집합은 절대 지우지 않는다** — 지우면 그 자리에 별밭 자리표시자가 덮인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { layerSetsToEvict, MAX_CACHED_LAYER_SETS } = require("../src/lib/map-songs-cache.ts");

const set = (key, usedAt, active = false) => ({ key, usedAt, active });

test("상한 아래면 아무것도 버리지 않는다", () => {
  assert.deepEqual(layerSetsToEvict([set("a", 1), set("b", 2)], 4), []);
});

test("넘치면 오래 안 쓴 것부터 넘친 만큼만 버린다", () => {
  const entries = [set("old", 1), set("mid", 2), set("new", 3), set("newest", 4)];
  assert.deepEqual(layerSetsToEvict(entries, 2), ["old", "mid"]);
});

/**
 * **이 파일의 핵심이다.** 보고 있는 집합을 지우면 지도가 빈손이 되고, `map-view` 는 집합이
 * 없는 동안 별밭 자리표시자를 덮는다 — 겹을 옮기는 중이면 연출 한가운데서 화면이 꺼진다.
 */
test("보는 컴포넌트가 있는 집합은 가장 오래됐어도 지우지 않는다", () => {
  const entries = [set("watching", 1, true), set("idle", 2), set("newer", 3)];
  // 하나만 넘쳤다 — 가장 오래된 것은 `watching` 이지만 보고 있으므로 그 다음이 나간다
  assert.deepEqual(layerSetsToEvict(entries, 2), ["idle"]);
});

test("버릴 수 있는 게 모자라면 상한을 넘은 채로 둔다 — 쓰는 것을 빼앗지 않는다", () => {
  const entries = [set("a", 1, true), set("b", 2, true), set("c", 3, true)];
  assert.deepEqual(layerSetsToEvict(entries, 1), []);
});

/** 한 번 파고드는 길이 8겹이다. 왕복 한 벌이 들어가고도 남아야 오르내림이 캐시에서 온다 */
test("상한은 파고드는 길 한 벌보다 넉넉하다", () => {
  assert.ok(MAX_CACHED_LAYER_SETS >= 16);
});
