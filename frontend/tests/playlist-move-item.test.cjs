/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **플리 곡 한 칸 옮기기** (S15P21A405-540).
 *
 * 배열 한 줄짜리로 보이지만 경계에서 조용히 틀린다. 범위를 벗어난 자리로 옮기면 `splice` 가
 * 아무 말 없이 맨 끝에 붙이거나 `undefined` 를 끼워 넣는데, 그러면 **곡이 하나 빠진 목록**이
 * 서버에 올라가 순서만 바꾸려다 곡을 잃는다. 화면에는 오류가 안 뜬다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { moveItem } = require("../src/hooks/mutations/use-reorder-playlist-items-mutation.ts");

const L = [1, 2, 3, 4];

test("위로 한 칸", () => {
  assert.deepEqual(moveItem(L, 2, 1), [1, 3, 2, 4]);
});

test("아래로 한 칸", () => {
  assert.deepEqual(moveItem(L, 1, 2), [1, 3, 2, 4]);
});

test("맨 앞에서 맨 뒤로 — 멀리 옮겨도 곡이 안 빠진다", () => {
  assert.deepEqual(moveItem(L, 0, 3), [2, 3, 4, 1]);
});

test("제자리면 같은 배열을 그대로 돌려준다 — 부를 필요가 없다는 신호다", () => {
  assert.equal(moveItem(L, 2, 2), L);
});

test("범위 밖이면 손대지 않는다 — undefined 가 끼면 곡이 사라진다", () => {
  assert.equal(moveItem(L, 0, 4), L, "끝을 넘어선 자리");
  assert.equal(moveItem(L, 0, -1), L, "첫 칸보다 앞");
  assert.equal(moveItem(L, 9, 0), L, "없는 곡을 옮기려 함");
  assert.equal(moveItem(L, -1, 0), L);
});

test("어떻게 옮기든 곡의 구성과 개수는 그대로다", () => {
  for (let from = 0; from < L.length; from++) {
    for (let to = 0; to < L.length; to++) {
      const out = moveItem(L, from, to);
      assert.equal(out.length, L.length, `${from}→${to} 에서 개수가 변했다`);
      assert.deepEqual([...out].sort(), [...L].sort(), `${from}→${to} 에서 구성이 변했다`);
    }
  }
});

test("원본을 건드리지 않는다 — 캐시에 들어 있는 배열일 수 있다", () => {
  const original = [1, 2, 3, 4];
  moveItem(original, 0, 3);
  assert.deepEqual(original, [1, 2, 3, 4]);
});

test("한 곡짜리 목록은 옮길 곳이 없다", () => {
  const one = [7];
  assert.equal(moveItem(one, 0, 0), one);
  assert.equal(moveItem(one, 0, 1), one);
});
