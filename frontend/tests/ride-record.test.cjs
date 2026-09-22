/* eslint-disable @typescript-eslint/no-require-imports */
// 따라가는 동안의 곡별 재생 기록 (3차 계약 §3, S15P21A405-545).
// 소켓이 와야 재현되는 자리라 화면으로는 확인할 수 없다. 규칙을 수치로 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { endOf, onTrackChange } = require("../src/lib/realtime/ride-record.ts");
const { PLAY_END } = require("../src/constants/realtime.ts");

const T0 = 1_700_000_000_000;

test("곡이 바뀌면 앞 곡의 종료가 나가고 번호가 새것으로 바뀐다", () => {
  const prev = { playHistoryId: 912, songStartedAt: T0 };
  const { end, next } = onTrackChange(prev, 913, T0 + 90_000);

  assert.deepEqual(end, { playHistoryId: 912, playedMs: 90_000 }, "앞 곡 번호로, 그 곡을 들은 만큼");
  assert.deepEqual(next, { playHistoryId: 913, songStartedAt: T0 + 90_000 }, "새 곡은 지금부터 센다");
});

/**
 * **번호를 추측해 보내면 안 된다.** 없는 번호로 보내면 400 이고, 아무 번호나 넣으면 남의
 * 기록을 건드린다. 기록이 없는 곡은 그냥 시간이 안 남는 것이 맞다.
 */
test("서버가 번호를 못 준 곡은 종료를 보내지 않는다", () => {
  const { end, next } = onTrackChange({ playHistoryId: null, songStartedAt: T0 }, 913, T0 + 60_000);
  assert.equal(end, null, "앞 곡에 번호가 없으면 보낼 것이 없다");
  assert.equal(next.playHistoryId, 913);
});

test("새 곡의 번호가 null 이어도 재생은 이어진다 — 그 곡만 시간이 안 남는다", () => {
  const { end, next } = onTrackChange({ playHistoryId: 912, songStartedAt: T0 }, null, T0 + 30_000);
  assert.deepEqual(end, { playHistoryId: 912, playedMs: 30_000 }, "앞 곡은 정상적으로 닫는다");
  assert.equal(next.playHistoryId, null, "이 곡은 건너뛴다");
  assert.equal(next.songStartedAt, T0 + 30_000, "시작 시각은 그래도 갱신한다");
});

test("아직 아무 곡도 안 틀었으면 보낼 것이 없다", () => {
  assert.equal(onTrackChange(null, 913, T0).end, null);
  assert.equal(endOf(null, T0), null);
});

/**
 * 탭을 열어 두고 방치하면 경과시간이 실제로 들은 시간과 상관없이 커진다 (1차 §12.6).
 * 큰 값은 서버가 거부하므로 자르는 쪽이 프론트 몫이다.
 */
test("들은 시간은 상한으로 자르고 음수로 내려가지 않는다", () => {
  const long = endOf({ playHistoryId: 5, songStartedAt: T0 }, T0 + PLAY_END.maxMs * 10);
  assert.equal(long.playedMs, PLAY_END.maxMs, "상한을 넘기지 않는다");

  // 기기 시계가 뒤로 틀어지면 지금이 시작보다 앞설 수 있다
  const negative = endOf({ playHistoryId: 5, songStartedAt: T0 }, T0 - 5_000);
  assert.equal(negative.playedMs, 0, "음수는 400 VALIDATION_ERROR 다");
});

test("하차할 때도 같은 함수로 마지막 곡을 닫는다", () => {
  const last = endOf({ playHistoryId: 914, songStartedAt: T0 }, T0 + 45_000);
  assert.deepEqual(last, { playHistoryId: 914, playedMs: 45_000 });
});
