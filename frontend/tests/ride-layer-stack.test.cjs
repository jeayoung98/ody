/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **따라가기로 내려간 겹에서 하차하면 떠오를 수 있어야 한다** (S15P21A405-627).
 *
 * `rideToLayer` 가 겹은 옮기면서 떠오르기용 스택을 안 쌓아서, 하차한 사람이 그 겹에 갇혔다.
 * 오류가 안 난다 — 휠을 돌려도 축소만 되고 버튼도 안 보여서 "왜 안 올라가지" 로만 읽힌다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { DRILL } = require("../src/constants/map.ts");

const pt = (id, x, y) => ({ musicId: id, pc: Array.from({ length: 16 }, (_, k) => (k % 2 ? y : x)), genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
const HOME = 25;
const leader = (musicId) => ({ email: "L", nickname: "L", isOnline: true, isPublic: true, musicId, viewingMusicId: musicId, x: 0, y: 0, avatarSeed: [0.5], genreId: 1, riderCount: 0 });

/** 모프가 끝날 때까지 돌린다 */
function settle(e, t) {
  for (let k = 0; k <= DRILL.morphMs / 16 + 20; k++) e.frame((t += 16));
  return t;
}

function boardAndDive(toLayer) {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  e.startFollow(leader(HOME), true);
  t = settle(e, t);
  assert.equal(e.rideToLayer(toLayer, HOME), true);
  t = settle(e, t);
  assert.equal(e.layer, toLayer, "인솔자를 따라 내려갔다");
  return { e, t };
}

test("한 겹 내려갔다 하차하면 떠오를 수 있다", () => {
  const { e, t } = boardAndDive(1);
  e.ascend();
  let now = settle(e, t);
  assert.equal(e.layer, 1, "따라가는 중에는 못 올라간다 (605)");
  e.stopFollow();
  assert.equal(e.stack.length > 0, true, "하차하면 올라갈 길이 있어야 한다 (canRise)");
  e.ascend();
  settle(e, now);
  assert.equal(e.layer, 0);
});

test("여러 겹을 한 번에 내려갔어도 중간 겹을 거쳐 올라온다", () => {
  const { e, t } = boardAndDive(3);
  e.stopFollow();
  e.ascend();
  let now = settle(e, t);
  assert.equal(e.layer, 2, "한 칸씩 — 건너뛴 겹에도 프레임이 있어야 한다");
  e.ascend();
  now = settle(e, now);
  assert.equal(e.layer, 1);
  e.ascendTo(0);
  settle(e, now);
  assert.equal(e.layer, 0);
});

test("인솔자가 올라가면 그 위 겹 프레임만 남는다", () => {
  const { e, t } = boardAndDive(3);
  assert.equal(e.rideToLayer(1, HOME), true);
  e.follow = null;
  settle(e, t);
  assert.equal(e.layer, 1);
  e.ascend();
  settle(e, t);
  assert.equal(e.layer, 0);
});
