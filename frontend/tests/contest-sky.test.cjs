/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **이벤트 탑 작품을 최상단 겹 제자리에 놓기** (S15P21A405-684).
 *
 * 작품 좌표는 백엔드 `PlanarProjection` 이 pc1·pc2 에서 평균을 빼고 한 배율로 나눈 값이다. 곡 둘의 실제 좌표로
 * 그 평균·배율을 되살리는 계산이 틀리면 지도에서 모양이 엉뚱한 곳·크기로 그려진다 — 화면에서는 "모양이 좀 다르네" 로만 보인다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { anchorPair, contestRankOf, distSqToSegment, fitLayout, toSkyShape, topEntries } = require("../src/lib/contest-sky.ts");

/** 백엔드 PlanarProjection 을 그대로 옮긴 것 — 실제 pc1·pc2 로 작품 좌표를 만든다 */
function project(world) {
  const n = world.length;
  const mx = world.reduce((s, p) => s + p.x, 0) / n;
  const my = world.reduce((s, p) => s + p.y, 0) / n;
  const span = Math.max(...world.map((p) => Math.max(Math.abs(p.x - mx), Math.abs(p.y - my))));
  return world.map((p) => ({ musicId: p.musicId, title: null, artist: null, x: (p.x - mx) / span, y: (p.y - my) / span }));
}

const WORLD = [
  { musicId: 11, x: 3.2, y: -1.5 },
  { musicId: 12, x: 5.9, y: 0.4 },
  { musicId: 13, x: 4.1, y: 2.8 },
  { musicId: 14, x: 1.7, y: 1.1 },
];

const entry = (over = {}) => ({
  artworkId: 1, rank: 1, title: "고양이", ownerEmail: null, ownerNickname: null, status: "SCORED", score: 80,
  aiComment: null, failReason: null, likeCnt: 0, likedByMe: false, musicCnt: 4, createdAt: "2026-09-26T00:00:00Z",
  rankScore: 1, closed: true, tracks: project(WORLD), playlistId: 77, ...over,
});

test("곡 둘만 알아도 나머지 곡이 실제 자리로 돌아온다", () => {
  const tracks = project(WORLD);
  const [a, b] = anchorPair(tracks);
  const known = new Map(WORLD.filter((w) => w.musicId === a.musicId || w.musicId === b.musicId).map((w) => [w.musicId, { x: w.x, y: w.y }]));
  const shape = toSkyShape(entry(), known);
  for (const w of WORLD) {
    const p = shape.pts.find((q) => q.musicId === w.musicId);
    assert.ok(Math.abs(p.x - w.x) < 1e-9 && Math.abs(p.y - w.y) < 1e-9, `${w.musicId}: ${p.x},${p.y} ≠ ${w.x},${w.y}`);
  }
});

test("아는 곡이 하나뿐이면 맞추지 않는다 — 배율을 알 수 없다", () => {
  assert.equal(fitLayout(project(WORLD), new Map([[11, { x: 3.2, y: -1.5 }]])), null);
});

test("배치가 한 점이면 맞추지 않는다", () => {
  const tracks = [{ musicId: 1, x: 0, y: 0 }, { musicId: 2, x: 0, y: 0 }];
  assert.equal(fitLayout(tracks, new Map([[1, { x: 1, y: 1 }], [2, { x: 2, y: 2 }]])), null);
});

test("기준 쌍은 배치에서 가장 멀리 떨어진 두 곡이다", () => {
  const tracks = [{ musicId: 1, x: 0, y: 0 }, { musicId: 2, x: 0.1, y: 0 }, { musicId: 3, x: 1, y: 1 }];
  const [a, b] = anchorPair(tracks);
  assert.deepEqual([a.musicId, b.musicId].sort(), [1, 3]);
});

test("탑 작품은 순위순 n 개 — 순위 없는 것·점 하나짜리는 뺀다", () => {
  const items = [
    entry({ artworkId: 3, rank: 3 }),
    entry({ artworkId: 1, rank: 1 }),
    entry({ artworkId: 9, rank: null }),
    entry({ artworkId: 2, rank: 2, tracks: project(WORLD).slice(0, 1) }),
    entry({ artworkId: 4, rank: 4 }),
  ];
  assert.deepEqual(topEntries(items, 2).map((e) => e.artworkId), [1, 3]);
});

test("재생 중인 플리가 탑 작품이면 그 순위, 아니면 null", () => {
  const items = [entry({ artworkId: 1, rank: 1, playlistId: 70 }), entry({ artworkId: 2, rank: 2, playlistId: 71 })];
  assert.equal(contestRankOf(items, 71), 2);
  assert.equal(contestRankOf(items, 99), null);
  assert.equal(contestRankOf(items, null), null);
  assert.equal(contestRankOf(undefined, 71), null);
});

test("플리 번호가 없는 작품(응답에 아직 없음)은 어떤 플리와도 맞지 않는다", () => {
  assert.equal(contestRankOf([entry({ playlistId: null })], 77), null);
});

test("선분까지 거리 — 끝점 밖은 끝점까지 잰다", () => {
  assert.equal(distSqToSegment(5, 3, 0, 0, 10, 0), 9);
  assert.equal(distSqToSegment(13, 4, 0, 0, 10, 0), 25);
  assert.equal(distSqToSegment(2, 2, 1, 1, 1, 1), 2);
});
