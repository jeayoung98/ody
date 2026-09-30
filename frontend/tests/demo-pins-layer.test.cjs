/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **시연 곡은 자기 겹·자기 갈래에서만 뜬다** (S15P21A405-726).
 *
 * 예전(717)에는 어느 겹의 마스크에서도 남겨서, 다른 갈래로 파고들어도 시연 곡이 떠 있었다. 이제
 * ① `minLayer` 보다 얕은 겹에서는 감추고 ② 파고든 사각형 밖이면 뺀다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { DRILL } = require("../src/constants/map.ts");
const { insideBoxes } = require("../src/components/map/engine/my-place.ts");

const pt = (id, x, y) => ({ musicId: id, pc: Array.from({ length: 16 }, (_, k) => (k % 2 ? y : x)), genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
const HOME = 25; // (0, 0)
const FAR = 1; // (-2.1, -2.1)
const leader = (musicId) => ({ email: "L", nickname: "L", isOnline: true, isPublic: true, musicId, viewingMusicId: musicId, x: 0, y: 0, avatarSeed: [0.5], genreId: 1, riderCount: 0 });

function settle(e, t) {
  for (let k = 0; k <= DRILL.morphMs / 16 + 20; k++) e.frame((t += 16));
  return t;
}
const alive = (e, id) => e.subset[e.indexOf(id)] === 1;

test("minLayer 가 있는 시연 곡은 최상단에서 감추고, 파고들면 보인다", () => {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  e.setDemoIds([HOME, FAR], new Map([[FAR, 0], [HOME, 1]]));
  assert.equal(alive(e, FAR), true, "minLayer 0 은 최상단에 있다");
  assert.equal(alive(e, HOME), false, "minLayer 1 은 최상단에서 감춘다");

  e.startFollow(leader(HOME), true);
  t = settle(e, t);
  assert.equal(e.rideToLayer(1, HOME), true);
  t = settle(e, t);
  assert.equal(e.layer, 1);
  // 검사 전제: HOME 은 파고든 사각형 안, FAR 는 밖 — 밖이면 시연 곡이라도 빠져야 뜻이 있는 검사다
  assert.equal(insideBoxes(songs[HOME - 1].pc, e.boxes, 1), true);
  assert.equal(insideBoxes(songs[FAR - 1].pc, e.boxes, 1), false);
  // 서버가 이 겹 곡을 주면(top-k 라 시연 곡이 빠질 수 있다 — 여기선 HOME 을 뺀다) 시연 곡을 끼워 넣는다
  const inBox = songs.filter((s) => s.musicId !== HOME && insideBoxes(s.pc, e.boxes, 1));
  e.setLayerSongs(1, inBox);
  settle(e, t); // 집합 교체는 교차 페이드라 끝나야 상주가 바뀐다
  assert.equal(alive(e, HOME), true, "파고든 겹에서 사각형 안의 시연 곡은 top-k 에 빠졌어도 보인다");
  assert.equal(alive(e, FAR), false, "다른 갈래의 시연 곡은 뜨지 않는다");
});
