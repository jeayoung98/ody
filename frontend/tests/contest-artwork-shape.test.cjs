/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **작품 상세 → 그림 좌표** (S15P21A405-701). 채점 끝난 내 작품 카드가 이걸로 별자리를 그린다.
 * 곡이 지워지면 이름만 null 이고 원소는 남는다 — 원소가 빠지면 별자리 순번이 어긋나 모양이 깨진다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toShape } = require("../src/lib/contest-bff.ts");

test("좌표·닫힘을 그대로 옮기고, 이름이 없는 곡도 원소는 남긴다", () => {
  const s = toShape({
    artworkId: 7,
    closed: true,
    tracks: [
      { musicId: 1, title: "A", artist: "X", x: -0.5, y: 0.2 },
      { musicId: 2, title: null, artist: null, x: 0.4, y: -0.1 },
    ],
  });
  assert.equal(s.artworkId, 7);
  assert.equal(s.closed, true);
  assert.equal(s.tracks.length, 2);
  assert.deepEqual(s.tracks[1], { musicId: 2, title: null, artist: null, x: 0.4, y: -0.1 });
});

test("tracks 가 없으면 빈 그림 — 카드는 그림 자리만 비운다", () => {
  assert.deepEqual(toShape({ artworkId: 7, closed: false, tracks: null }).tracks, []);
});
