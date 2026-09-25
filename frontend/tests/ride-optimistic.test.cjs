/* eslint-disable @typescript-eslint/no-require-imports */
// 따라가기를 누른 즉시 화면을 세워도 되는 경우 (S15P21A405-642).
//
// 먼저 세우는 이득은 체감뿐이고, 잘못 세우면 **멀쩡히 타고 있던 선단에서 내려진다.**
// 그 경계가 조건문 한 줄로 묻혀 있으면 다음에 누가 지운다. 그래서 여기 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canRideOptimistically } = require("../src/lib/realtime/ride-optimistic.ts");

test("아무도 안 따라가는 중이면 먼저 세운다", () => {
  assert.equal(canRideOptimistically({ ridingEmail: null, targetEmail: "a@ody.kr", silent: false }), true);
});

/**
 * **이 파일의 핵심이다.** A 를 따라가는 중에 B 를 누르면 서버가 `RIDE_ALREADY_RIDING` 으로
 * 막는다. 그런데 화면을 먼저 B 로 세워 두면 되돌릴 자리가 A 가 아니라 아무 데도 아니게 되고,
 * 거절 처리(endRide)가 타고 있던 선단까지 내려 버린다.
 */
test("남을 따라가는 중이면 먼저 세우지 않는다", () => {
  assert.equal(canRideOptimistically({ ridingEmail: "a@ody.kr", targetEmail: "b@ody.kr", silent: false }), false);
});

/** 같은 사람을 다시 누른 것은 갈아타기가 아니다 — 되돌릴 자리가 그대로라 안전하다 */
test("같은 사람을 다시 누르는 것은 먼저 세워도 된다", () => {
  assert.equal(canRideOptimistically({ ridingEmail: "a@ody.kr", targetEmail: "a@ody.kr", silent: false }), true);
});

/** 다시 잇기는 사용자가 누른 것이 아니라 소켓이 다시 열려 도는 복구 경로다 */
test("다시 잇기는 확정 전에 화면을 세우지 않는다", () => {
  assert.equal(canRideOptimistically({ ridingEmail: null, targetEmail: "a@ody.kr", silent: true }), false);
  assert.equal(canRideOptimistically({ ridingEmail: "a@ody.kr", targetEmail: "a@ody.kr", silent: true }), false);
});
