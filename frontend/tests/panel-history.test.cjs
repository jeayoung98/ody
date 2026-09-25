/* eslint-disable @typescript-eslint/no-require-imports */
// 패널 뒤로가기 스택 (S15P21A405-659). 타고 들어간 길을 순서대로 되돌아가야 하고, 새로 여는 길은 스택을
// 비워야 한다 — 틀리면 랭킹에서 프로필로 들어갔다가 돌아갈 곳이 없거나, 지도에서 연 곡 상세에 엉뚱한 화살표가 선다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { snapshotOf, pushHistory, sameReturn, PANEL_HISTORY_MAX } = require("../src/lib/panel-history.ts");

const state = (over) => ({ activePanel: null, musicId: null, playlistId: null, profileEmail: null, feedFollows: null, ...over });

test("지금 패널을 돌아갈 자리로 찍는다 — 다시 세우는 데 필요한 것만", () => {
  assert.deepEqual(snapshotOf(state({ activePanel: "chart" })), { panel: "chart" });
  assert.deepEqual(snapshotOf(state({ activePanel: "song", musicId: 7 })), { panel: "song", musicId: 7 });
  assert.deepEqual(snapshotOf(state({ activePanel: "playlist", playlistId: 3 })), { panel: "playlist", playlistId: 3 });
  assert.deepEqual(snapshotOf(state({ activePanel: "feed", profileEmail: "a@b.c", feedFollows: "follower" })), { panel: "feed", profileEmail: "a@b.c", follows: "follower" });
  assert.equal(snapshotOf(state()), null, "닫혀 있으면 없다");
  assert.equal(snapshotOf(state({ activePanel: "song", musicId: null })), null, "곡이 없는 곡 상세는 세울 수 없다");
});

test("타고 들어갈 때마다 쌓이고, 순서대로 되돌아간다", () => {
  let h = [];
  h = pushHistory(h, { panel: "chart" }, { panel: "feed", profileEmail: "a@b.c" });
  h = pushHistory(h, { panel: "feed", profileEmail: "a@b.c" }, { panel: "playlist", playlistId: 3 });
  h = pushHistory(h, { panel: "playlist", playlistId: 3 }, { panel: "song", musicId: 7 });
  assert.deepEqual(h.map((r) => r.panel), ["chart", "feed", "playlist"]);
  assert.deepEqual(h[h.length - 1], { panel: "playlist", playlistId: 3 }, "맨 뒤가 직전 자리");
});

test("같은 자리로 다시 가면 쌓지 않고, 닫힌 상태에서 열면 쌓을 것이 없다", () => {
  const feed = { panel: "feed", profileEmail: "a@b.c" };
  assert.deepEqual(pushHistory([], feed, feed), []);
  assert.deepEqual(pushHistory([{ panel: "chart" }], null, feed), [{ panel: "chart" }]);
  assert.equal(sameReturn({ panel: "feed", profileEmail: "a@b.c", follows: "follower" }, feed), false, "목록을 보던 자리는 다른 자리다");
  assert.equal(sameReturn({ panel: "song", musicId: 1 }, { panel: "song", musicId: 2 }), false);
});

test("상한을 넘으면 오래된 것부터 잊는다", () => {
  let h = [];
  for (let i = 0; i < PANEL_HISTORY_MAX + 3; i++) h = pushHistory(h, { panel: "song", musicId: i }, { panel: "song", musicId: i + 1 });
  assert.equal(h.length, PANEL_HISTORY_MAX);
  assert.equal(h[0].musicId, 3, "앞이 잘렸다");
});
