/* eslint-disable @typescript-eslint/no-require-imports */
// 브라우저에 저장해 둔 1겹을 그대로 그려도 되는가 (S15P21A405-680). 틀리면 모양이 바뀐 옛 저장본이나 몇 주 지난 우주를
// 사실처럼 그리거나, 반대로 멀쩡한 저장본을 버려 매번 1,576KB 를 다시 받는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MAP_SONGS_STORE } = require("../src/constants/map.ts");
const { isUsableSnapshot } = require("../src/lib/map-songs-store.ts");

const NOW = 1_800_000_000_000;
const point = { musicId: 1, pc: new Array(16).fill(0), genreId: 10, weight: 0, title: "t", artist: "a", youtubeUrl: null, albumMbid: null, playable: true };
const snap = (over = {}) => ({ v: MAP_SONGS_STORE.version, savedAt: NOW - 60_000, points: [point], ...over });

test("판이 같고 기한 안이고 곡이 있으면 쓴다", () => {
  assert.equal(isUsableSnapshot(snap(), NOW), true);
  assert.equal(isUsableSnapshot(snap({ savedAt: NOW - MAP_SONGS_STORE.maxAgeMs }), NOW), true, "기한 딱 끝까지는 쓴다");
});

test("저장본이 없거나 모양이 이상하면 안 쓴다", () => {
  assert.equal(isUsableSnapshot(undefined, NOW), false);
  assert.equal(isUsableSnapshot(null, NOW), false);
  assert.equal(isUsableSnapshot("x", NOW), false);
  assert.equal(isUsableSnapshot(snap({ points: "x" }), NOW), false);
  assert.equal(isUsableSnapshot(snap({ savedAt: "어제" }), NOW), false);
});

test("곡 모양의 판이 다르면 안 쓴다 — MapPoint 가 바뀌면 판을 올려 옛 저장본을 버린다", () => {
  assert.equal(isUsableSnapshot(snap({ v: MAP_SONGS_STORE.version + 1 }), NOW), false);
  assert.equal(isUsableSnapshot(snap({ v: undefined }), NOW), false);
});

test("기한이 지난 저장본은 안 쓴다", () => {
  assert.equal(isUsableSnapshot(snap({ savedAt: NOW - MAP_SONGS_STORE.maxAgeMs - 1 }), NOW), false);
});

test("기기 시계가 흔들려 미래에 저장된 것처럼 보이면 나이를 셀 수 없어 안 쓴다", () => {
  assert.equal(isUsableSnapshot(snap({ savedAt: NOW + 1 }), NOW), false);
});

test("빈 우주는 안 쓴다 — 그리면 별이 하나도 없다", () => {
  assert.equal(isUsableSnapshot(snap({ points: [] }), NOW), false);
});
