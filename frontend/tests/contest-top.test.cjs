/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **플레이어바 "이벤트 N위" 태그가 고르는 순위** (S15P21A405-684 · 687).
 *
 * 틀리면 탑 5 가 아닌 플리에 태그가 붙거나, 탑 5 플리를 틀어도 안 붙는다 — 화면에서는 조용히 틀린다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { contestRankOf, topEntries } = require("../src/lib/contest-top.ts");

const entry = (over = {}) => ({
  artworkId: 1, rank: 1, title: "고양이", ownerEmail: null, ownerNickname: null, status: "SCORED", score: 80,
  aiComment: null, failReason: null, likeCnt: 0, likedByMe: false, musicCnt: 4, createdAt: "2026-09-26T00:00:00Z",
  rankScore: 1, closed: true, tracks: [], playlistId: 77, ...over,
});

test("탑 작품은 순위순 n 개 — 순위 없는 것은 뺀다", () => {
  const items = [entry({ artworkId: 3, rank: 3 }), entry({ artworkId: 1, rank: 1 }), entry({ artworkId: 9, rank: null }), entry({ artworkId: 4, rank: 4 })];
  assert.deepEqual(topEntries(items, 2).map((e) => e.artworkId), [1, 3]);
});

test("재생 중인 플리가 탑 작품이면 그 순위, 아니면 null", () => {
  const items = [entry({ artworkId: 1, rank: 1, playlistId: 70 }), entry({ artworkId: 2, rank: 2, playlistId: 71 })];
  assert.equal(contestRankOf(items, 71), 2);
  assert.equal(contestRankOf(items, 99), null);
  assert.equal(contestRankOf(items, null), null);
  assert.equal(contestRankOf(undefined, 71), null);
});

test("6위 플리에는 태그가 안 붙는다", () => {
  const items = Array.from({ length: 6 }, (_, i) => entry({ artworkId: i + 1, rank: i + 1, playlistId: 100 + i }));
  assert.equal(contestRankOf(items, 104), 5);
  assert.equal(contestRankOf(items, 105), null);
});

test("플리 번호가 없는 작품(응답에 아직 없음)은 어떤 플리와도 맞지 않는다", () => {
  assert.equal(contestRankOf([entry({ playlistId: null })], 77), null);
});
