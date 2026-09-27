/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 새로고침 복원 — 소켓 재탑승이 지도 데이터보다 먼저 끝난다 (S15P21A405-676).
 * 그때 인솔자 곡을 빈 엔진에 편입해 두는데, 첫 데이터가 오면서 그 곡이 지워지면 우주선이 영영 안 걸린다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

const pt = (id, x, y) => ({ musicId: id, pc: [x, y, ...Array(14).fill(0)], genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null, playable: true });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
const LEADER_SONG = 9999;
const leader = (musicId) => ({ email: "L", nickname: "L", imageUrl: null, isOnline: true, musicId, viewingMusicId: musicId, avatarSeed: [0.5], genreId: 1, meetingCount: 0, riderCount: 0, followingNickname: null });

test("첫 데이터보다 먼저 편입한 인솔자 곡이 첫 데이터에 지워지지 않는다", () => {
  const e = new MapEngine();
  e.setSize(1280, 800);
  assert.equal(e.ready, false);
  e.adopt([pt(LEADER_SONG, 2.1, -0.7)]);
  assert.ok(e.pointOf(LEADER_SONG), "빈 엔진에도 편입은 된다");
  e.setLayerSongs(0, songs);
  assert.equal(e.ready, true);
  assert.ok(e.pointOf(LEADER_SONG), "예전엔 setSongs 가 통째로 갈아끼워 사라졌다");
  assert.equal(e.pointOf(songs[0].musicId).musicId, songs[0].musicId, "원래 집합은 그대로다");
});

test("그 뒤 따라가기를 걸면 우주선이 인솔자 곡에 서고 카메라가 그리로 간다", () => {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.adopt([pt(LEADER_SONG, 2.1, -0.7)]);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  e.startFollow(leader(LEADER_SONG), true);
  assert.ok(e.follow, "따라가기가 걸린다");
  for (let k = 0; k < 300; k++) e.frame((t += 16));
  const w = e.worldOf(LEADER_SONG);
  const s = e.worldToScreen(w.x, w.y);
  const fr = e.freeRect();
  const off = Math.hypot(s.px - fr.cx, s.py - fr.cy);
  assert.ok(off < 1, `인솔자 곡이 한복판에서 ${off.toFixed(1)}px 떨어져 있다`);
});
