/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **따라가기의 재생 위치 보정** (2차 실시간 명세 §4.1, S15P21A405-530).
 *
 * 틀려도 화면에는 아무 표시가 없다 — 곡이 엉뚱한 지점에서 시작할 뿐이라 "동기화가 좀 안 맞네"
 * 로 보이고, 기기 시계가 틀어진 사람에게만 재현된다. 소켓 없이 고정할 수 있는 부분이라 여기서 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { anchorPositionAt, driftTarget, positionNow } = require("../src/lib/realtime/ride.ts");
const { REALTIME } = require("../src/constants/realtime.ts");

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

// ── 어긋남 되돌리기 (S15P21A405-682) ─────────────────────────────────────────

test("기준에서 흐른 만큼 더한다 — 내 시계끼리만 뺀다", () => {
  const a = { musicId: 1, positionMs: 3_000, playing: true, localAt: 100_000 };
  assert.equal(anchorPositionAt(a, 107_000), 10_000);
});

test("멈춘 기준은 흐르지 않는다", () => {
  const a = { musicId: 1, positionMs: 3_000, playing: false, localAt: 100_000 };
  assert.equal(anchorPositionAt(a, 107_000), 3_000);
});

test("받은 시각보다 앞선 now 로는 되감지 않는다", () => {
  const a = { musicId: 1, positionMs: 3_000, playing: true, localAt: 100_000 };
  assert.equal(anchorPositionAt(a, 99_000), 3_000);
});

test("허용 범위 안이면 옮기지 않는다 — 버퍼링마다 소리가 튀면 안 된다", () => {
  const tol = REALTIME.rideDriftToleranceMs;
  assert.equal(driftTarget(60_000, 60_000 + tol, 200_000), null);
  assert.equal(driftTarget(60_000 + tol, 60_000, 200_000), null);
});

test("늦었거나 앞섰으면 기대 위치로 옮긴다", () => {
  const tol = REALTIME.rideDriftToleranceMs;
  assert.equal(driftTarget(50_000, 50_000 + tol + 1, 200_000), 50_000 + tol + 1);
  assert.equal(driftTarget(90_000, 80_000, 200_000), 80_000);
});

test("기대 위치가 곡 끝 근처면 옮기지 않는다 — 서버 곡 길이와 영상 길이가 다를 수 있다", () => {
  assert.equal(driftTarget(150_000, 199_500, 200_000), null);
  assert.equal(driftTarget(150_000, 260_000, 200_000), null);
});

test("영상 길이를 모르면(0) 끝 확인 없이 어긋남만 본다", () => {
  assert.equal(driftTarget(10_000, 30_000, 0), 30_000);
});
