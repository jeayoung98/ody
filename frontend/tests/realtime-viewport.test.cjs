/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **뷰포트 요청과 재생 종료값** (S15P21A405-482).
 *
 * 둘 다 틀려도 화면에는 아무 표시가 없다. 뷰포트는 `PRESENCE_VIEWPORT_INVALID` 가 오거나
 * 한 겹 어긋난 사람 목록이 오고, `playedMs` 는 서버에서 조용히 실패한다. 소켓을 띄우지 않고
 * 고정할 수 있는 부분이라 여기서 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { toViewportRequest } = require("../src/hooks/use-viewport-subscription.ts");
const { clampPlayed } = require("../src/hooks/mutations/use-play-end-mutation.ts");
const { PLAY_END } = require("../src/constants/realtime.ts");

const box = (layer, xMin, xMax, yMin, yMax) => ({ layer, xMin, xMax, yMin, yMax });

test("레이어 0 이면 ancestorBounds 는 빈 배열이다 — layer 는 boxes 길이다", () => {
  const r = toViewportRequest(1, [], box(0, -5, 4, -3, 6));
  assert.equal(r.layer, 0);
  assert.deepEqual(r.ancestorBounds, []);
  assert.deepEqual([r.minX, r.maxX, r.minY, r.maxY], [-5, 4, -3, 6]);
});

test("ancestorBounds 는 boxes 를 순서대로 옮긴다 — bounds[i].layer === i", () => {
  const boxes = [box(0, -5, 4, -3, 6), box(1, -1, 2.5, -2, 1.1)];
  const r = toViewportRequest(7, boxes, box(2, -2.15, 1.8, -0.9, 3.42));
  assert.equal(r.layer, 2, "layer 는 boxes.length 다 — +1 하지 않는다");
  assert.equal(r.ancestorBounds.length, 2);
  r.ancestorBounds.forEach((b, i) => assert.equal(b.layer, i));
  assert.deepEqual(r.ancestorBounds[1], { layer: 1, minX: -1, maxX: 2.5, minY: -2, maxY: 1.1 });
});

test("requestSeq 는 준 값을 그대로 쓴다 — join 카운터와 섞이면 안 된다", () => {
  assert.equal(toViewportRequest(42, [], box(0, 0, 1, 0, 1)).requestSeq, 42);
});

test("playedMs 는 곡 길이로 자른다 — 방치한 시간은 들은 시간이 아니다", () => {
  assert.equal(clampPlayed({ playHistoryId: 1, playedMs: 9_000_000 }, 183_000).playedMs, 183_000);
});

test("곡 길이를 모르면 상한으로 자른다", () => {
  assert.equal(clampPlayed({ playHistoryId: 1, playedMs: 9_000_000 }).playedMs, PLAY_END.maxMs);
});

test("음수는 0 이다 — 400 VALIDATION_ERROR 가 되는 값이다", () => {
  assert.equal(clampPlayed({ playHistoryId: 1, playedMs: -5 }).playedMs, 0);
});

test("정상 범위는 그대로 두되 정수로 보낸다", () => {
  assert.equal(clampPlayed({ playHistoryId: 1, playedMs: 1234.7 }).playedMs, 1235);
});
