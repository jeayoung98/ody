/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **겹 조회(기준) 위에 소켓 델타를 얹는 규칙** (S15P21A405-537).
 *
 * 틀려도 화면에는 아무 오류가 안 뜬다. 떠난 사람이 지도에 남거나, 방금 들어온 사람이
 * 10초 뒤에야 보이거나, 동승 인원이 옛 숫자로 되돌아갈 뿐이라 "가끔 이상하다" 로만 보인다.
 * 소켓도 React 도 없이 고정할 수 있는 부분이라 여기서 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { mergePeople } = require("../src/hooks/use-viewport-subscription.ts");

const user = (email, riderCount = 0) => ({ email, nickname: email, imageUrl: null, riderCount });
const group = (musicId, users, x = 1, y = 2) => ({ musicId, x, y, users });
const NONE = new Map();

test("얹은 것이 없으면 기준 목록 그대로다", () => {
  const people = mergePeople([group(10, [user("a@x.com"), user("b@x.com")])], NONE, NONE);
  assert.deepEqual([...people.keys()], ["a@x.com", "b@x.com"]);
  assert.equal(people.get("a@x.com").musicId, 10);
});

test("기준이 없어도 얹은 것만으로 그린다 — 조회 전에 델타가 먼저 올 수 있다", () => {
  const overlay = new Map([["c@x.com", { email: "c@x.com", musicId: 7, riderCount: 0 }]]);
  const people = mergePeople(undefined, overlay, NONE);
  assert.deepEqual([...people.keys()], ["c@x.com"]);
});

test("`null` 을 얹으면 기준에 있던 사람이 지워진다 — 그냥 빼면 기준이 되살아난다", () => {
  const overlay = new Map([["a@x.com", null]]);
  const people = mergePeople([group(10, [user("a@x.com"), user("b@x.com")])], overlay, NONE);
  assert.deepEqual([...people.keys()], ["b@x.com"]);
});

test("같은 사람이면 얹은 쪽이 이긴다 — 델타가 조회보다 최신이다", () => {
  const overlay = new Map([["a@x.com", { email: "a@x.com", musicId: 99, riderCount: 0 }]]);
  const people = mergePeople([group(10, [user("a@x.com")])], overlay, NONE);
  assert.equal(people.get("a@x.com").musicId, 99, "옮겨간 곡이 반영돼야 한다");
});

test("인원수는 맨 마지막에 덮는다 — 자리 변경이 숫자를 되돌리면 안 된다", () => {
  const overlay = new Map([["a@x.com", { email: "a@x.com", musicId: 99, riderCount: 0 }]]);
  const riders = new Map([["a@x.com", 3]]);
  const people = mergePeople([group(10, [user("a@x.com", 1)])], overlay, riders);
  assert.equal(people.get("a@x.com").musicId, 99, "자리는 얹은 값");
  assert.equal(people.get("a@x.com").riderCount, 3, "숫자는 인원수 델타 값");
});

test("이미 지워진 사람의 인원수가 와도 되살리지 않는다", () => {
  const overlay = new Map([["a@x.com", null]]);
  const riders = new Map([["a@x.com", 5]]);
  const people = mergePeople([group(10, [user("a@x.com")])], overlay, riders);
  assert.equal(people.has("a@x.com"), false);
});

test("모르는 사람의 인원수는 무시한다 — 좌표가 없어 그릴 수 없다", () => {
  const people = mergePeople([group(10, [user("a@x.com")])], NONE, new Map([["zzz@x.com", 4]]));
  assert.equal(people.has("zzz@x.com"), false);
});
