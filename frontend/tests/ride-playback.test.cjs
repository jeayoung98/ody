/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **따라가기의 재생 위치 보정** (2차 실시간 명세 §4.1, S15P21A405-530).
 *
 * 틀려도 화면에는 아무 표시가 없다 — 곡이 엉뚱한 지점에서 시작할 뿐이라 "동기화가 좀 안 맞네"
 * 로 보이고, 기기 시계가 틀어진 사람에게만 재현된다. 소켓 없이 고정할 수 있는 부분이라 여기서 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { positionNow } = require("../src/lib/realtime/ride.ts");

test("멈춰 있으면 경과를 더하지 않는다 — 정지 중에 위치가 흐르면 안 된다", () => {
  const tenSecondsAgo = Date.now() - 10_000;
  assert.equal(positionNow(73_400, "PAUSED", tenSecondsAgo), 73_400);
});

test("틀고 있으면 serverTs 이후 흐른 만큼을 더한다", () => {
  const twoSecondsAgo = Date.now() - 2_000;
  const at = positionNow(73_400, "PLAYING", twoSecondsAgo);
  assert.ok(at >= 75_300 && at <= 75_600, `2초쯤 더해져야 한다: ${at}`);
});

test("기기 시계가 과거로 틀어져 있어도 곡 끝으로 날아가지 않는다 — 보정을 자른다", () => {
  const oneHourAgo = Date.now() - 3_600_000;
  const at = positionNow(1_000, "PLAYING", oneHourAgo);
  assert.ok(at <= 1_000 + 10_000, `보정 상한을 넘겼다: ${at}`);
});

test("기기 시계가 미래로 틀어져 있어도 음수가 되지 않는다", () => {
  const inAnHour = Date.now() + 3_600_000;
  assert.equal(positionNow(5_000, "PLAYING", inAnHour), 5_000);
});

test("음수 위치는 0 으로 막는다 — seekTo 에 음수를 넣으면 플레이어가 멈춘다", () => {
  assert.equal(positionNow(-1, "PAUSED", Date.now()), 0);
});
