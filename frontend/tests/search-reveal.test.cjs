/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **검색한 곡으로 지도가 실제로 이동한다** (S15P21A405-581).
 *
 * 규칙 자체는 `reveal-layer` 가 재고, 여기서는 엔진이 그 답대로 **움직이는지**를 본다 —
 * 겹을 옮기는지, 그 곡이 화면에 남는지. 어긋나도 오류가 안 나고 "눌렀는데 가만히 있다" 로만 보인다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

const pt = (id, x, y) => ({ musicId: id, pc: Array.from({ length: 16 }, (_, k) => (k === 0 ? x : k === 1 ? y : (id % 7) - 3)), genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null, playable: false });
const songs = [];
for (let gx = -2, id = 1; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) songs.push(pt(id++, gx * 0.6, gy * 0.6));

function engine() {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  e.frame(performance.now());
  return e;
}

/** 파고든 상태를 흉내 낸다 — 겹 `layer` 에 서 있고, 위 겹마다 상주 마스크를 하나씩 남겨 두었다 */
function drilled(e, layer, residentPerLayer) {
  const box = (l) => ({ layer: l, xMin: -9, xMax: 9, yMin: -9, yMax: 9 });
  e.layer = layer;
  e.boxes = Array.from({ length: layer }, (_, l) => box(l));
  e.stack = Array.from({ length: layer }, (_, l) => ({
    layer: l,
    cam: { ...e.cam },
    subset: mask(residentPerLayer[l] ?? []),
    entryS: e.cam.s,
  }));
  // 지금 겹에는 아무것도 상주하지 않는다고 둔다 — 검색한 곡이 여기 없는 상황이다
  e.subset = mask(residentPerLayer[layer] ?? []);
  e.rebuildAliveIdx();
}
const idx = (id) => songs.findIndex((s) => s.musicId === id);
const mask = (ids) => {
  const m = new Uint8Array(songs.length);
  for (const id of ids) m[idx(id)] = 1;
  return m;
};

test("이 겹에 있는 곡은 겹을 안 옮기고 확대해 간다", () => {
  const e = engine();
  assert.equal(e.isAlive(7), true, "레이어 0 에서는 다 상주한다");
  assert.equal(e.revealSong(7), "focused");
  assert.equal(e.selectedId, 7);
  assert.equal(e.anim, null, "겹을 옮기지 않았다");
});

test("위 겹에 있는 곡이면 그중 가장 가까운 겹으로 올라간다", () => {
  const e = engine();
  // 겹 3 에 서 있고, 찾는 곡(9)은 겹 0 과 겹 2 에 있다 — 겹 2 가 가장 가깝다
  drilled(e, 3, { 0: [9, 1], 1: [1], 2: [9, 1], 3: [1] });
  assert.equal(e.isAlive(9), false, "지금 겹에는 없다");
  assert.equal(e.revealSong(9), "risen");
  assert.equal(e.anim.layer, 2, "한 번에 0 까지 가지 않는다");
  assert.equal(e.centerAfterMorph, 9, "도착하면 그 곡을 한복판에 둔다");
});

test("어느 겹에도 없는 곡이면 최상위까지 올라가 그 자리에 끼워 넣는다", () => {
  const e = engine();
  drilled(e, 2, { 0: [1], 1: [1], 2: [1] });
  assert.equal(e.revealSong(9), "surfaced");
  assert.equal(e.anim.layer, 0);
  // 레이어 0 상주 집합에 없던 곡이라, 끼워 넣지 않으면 올라가 봐야 화면에 없다
  assert.equal(e.anim.subset[idx(9)], 1);
});

test("최상위에서는 겹을 안 옮기고 그 자리에 바로 띄운다", () => {
  const e = engine();
  // 레이어 0 인데 서버 top-k 에서 빠진 곡
  e.subset = mask([1, 2, 3]);
  e.rebuildAliveIdx();
  assert.equal(e.isAlive(9), false);
  assert.equal(e.revealSong(9), "focused");
  assert.equal(e.anim, null, "옮길 겹이 없다");
  assert.equal(e.isAlive(9), true, "그 자리에 띄운다");
});

/** 내 자리는 재생 중인 곡이지 보러 간 곡이 아니다 (MAP-08) */
test("보러 가도 내 위치는 그대로다 — 내 위치로 가기가 살아 있다", () => {
  const e = engine();
  e.travelTo(3);
  assert.equal(e.canGoHome(), true);
  drilled(e, 2, { 0: [1], 1: [1], 2: [1] });
  e.revealSong(9);
  // `travelTo` 는 곧바로 `home` 을 갈아 끼운다 (표식은 날아가는 중이라 `myId` 는 도착해야 붙는다)
  assert.equal(e.home.musicId, 3, "돌아갈 자리가 검색한 곡으로 바뀌지 않았다");
  assert.equal(e.canGoHome(), true, "내 위치로 가기가 살아 있다");
});

test("지도가 모르는 곡은 손대지 않는다 — 좌표가 없으면 놓을 자리가 없다", () => {
  const e = engine();
  assert.equal(e.revealSong(99999), "none");
});
