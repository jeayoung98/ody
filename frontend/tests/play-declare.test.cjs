/* eslint-disable @typescript-eslint/no-require-imports */
// 재생 선언을 언제, 무엇으로 보내는가 (S15P21A405-569).
// 선언 하나가 서버에서 다섯 가지를 한다 — 위치·기록·발견자·만남·RIDE_TRACK.
// 한 번 빠지면 다섯이 통째로 빠지고, 잘못 보내면 409 가 곡마다 쌓인다. 둘 다 화면에 안 보인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { playSourceOf, shouldDeclare } = require("../src/lib/play-declare.ts");

const base = { musicId: 10, declareSeq: 1, lastSeq: null, riding: false };

test("목록 종류가 source 가 된다", () => {
  assert.equal(playSourceOf("journey"), "JOURNEY");
  assert.equal(playSourceOf("playlist"), "PLAYLIST");
  assert.equal(playSourceOf("single"), "MAP");
  // 주변 탐색은 백엔드 enum 에 없다 — 지도에서 걸어 들어간 것이라 MAP 으로 친다
  assert.equal(playSourceOf("nearby"), "MAP");
});

test("새 번호면 선언한다", () => {
  assert.equal(shouldDeclare(base), true, "첫 재생");
  assert.equal(shouldDeclare({ ...base, declareSeq: 5, lastSeq: 4 }), true, "큐가 넘어갔다");
});

test("같은 번호를 두 번 보내지 않는다", () => {
  assert.equal(shouldDeclare({ ...base, declareSeq: 3, lastSeq: 3 }), false);
});

/**
 * 곡 ID 로 비교하면 놓친다 — 한 바퀴 돌아 제자리로 왔거나 이전 버튼으로 되돌아온 경우도
 * 서버 입장에서는 새 재생이다. 그래서 번호로 가른다.
 */
test("같은 곡을 다시 틀어도 번호가 다르면 선언한다", () => {
  assert.equal(shouldDeclare({ musicId: 10, declareSeq: 7, lastSeq: 6, riding: false }), true);
});

test("따라가는 중에는 한 건도 안 보낸다", () => {
  // RIDE_TRACK 이 playFrom → playSingle 을 타므로 곡마다 번호가 오른다.
  // 그대로 두면 곡마다 409 RIDE_NOT_CAPTAIN 이 한 건씩 나간다
  assert.equal(shouldDeclare({ ...base, riding: true }), false);
  assert.equal(shouldDeclare({ ...base, declareSeq: 9, lastSeq: 1, riding: true }), false);
});

test("틀 곡이 없으면 안 보낸다", () => {
  assert.equal(shouldDeclare({ ...base, musicId: null }), false, "정지 직후");
});
