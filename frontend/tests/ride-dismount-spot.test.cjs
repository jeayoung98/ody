/* eslint-disable @typescript-eslint/no-require-imports */
// 하차한 자리는 인솔자 곡이다 (S15P21A405-677) — 되돌아가지 않는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { acceptsAnchor } = require("../src/components/map/engine/stale-anchor.ts");

const pt = (id, x, y) => ({ musicId: id, pc: [x, y, ...Array(14).fill(0)], genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null, playable: true });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
const MINE = 25; // (0,0)
const LEADER_A = 4; // (-2.1, 0)
const LEADER_B = 46; // (2.1, 0)
const leader = (musicId) => ({ email: "L", nickname: "L", imageUrl: null, isOnline: true, musicId, viewingMusicId: musicId, avatarSeed: [0.5], genreId: 1, meetingCount: 0, riderCount: 0, followingNickname: null });

function boarded() {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  e.travelTo(MINE);
  for (let k = 0; k < 120; k++) e.frame((t += 16));
  e.startFollow(leader(LEADER_A), true);
  return { e, t };
}

test("따라가는 중에 곡을 틀어도 내 비행을 걸지 않는다 — 묵은 travelToId 가 다음 자리를 거절하지 않게", () => {
  const { e } = boarded();
  e.travelTo(LEADER_A); // playFrom → playSingle → travelTo 가 이 길로 온다
  assert.equal(e.travelToId, null, "예전엔 여기 걸린 채로 남아 acceptsAnchor 가 다음 곡을 거절했다");
  assert.equal(acceptsAnchor(e.travelToId, LEADER_B), true);
  assert.deepEqual(e.home, { musicId: LEADER_A, boxes: [] }, "자리 기록은 인솔자 곡이다");
});

test("하차하면 표식·재생 곡·돌아갈 자리가 인솔자 곡에 남고 가운데 고정이 걸린다", () => {
  const { e, t } = boarded();
  e.rideTo(LEADER_B);
  e.follow.mv.t0 = t;
  let now = t;
  for (let k = 0; k < 400; k++) e.frame((now += 16));
  e.stopFollow();
  e.settleAfterRide(LEADER_B);
  const w = e.worldOf(LEADER_B);
  assert.deepEqual(e.me, w);
  assert.equal(e.myId, LEADER_B);
  assert.equal(e.travelToId, null);
  assert.equal(e.home.musicId, LEADER_B, "내 위치로 가기도 그 곡이다");
  for (let k = 0; k < 400; k++) e.frame((now += 16));
  assert.deepEqual(e.me, w, "프레임이 돌아도 되돌아가지 않는다");
  assert.equal(e.playingElsewhere(), false);
});
