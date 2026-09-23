/* eslint-disable @typescript-eslint/no-require-imports */
// presence 오류마다 어떤 복구가 붙는가 (S15P21A405-555).
//
// 이 규칙이 틀리면 화면에 아무 일도 안 일어난다 — 오류도 토스트도 없이, 남들 화면에서만
// 내가 사라진다. 혼자 띄워 놓고는 절대 못 찾는 종류라 수치로 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recoveryFor } = require("../src/lib/realtime/presence-recovery.ts");

/**
 * **이 파일의 핵심이다.** 실제로 났던 사고가 이 한 줄이 없어서였다.
 *
 * 백그라운드 탭은 heartbeat 타이머가 늘어져(실측 53~61초) 45초 TTL 을 못 지킨다. 만료되면
 * heartbeat 가 `PRESENCE_STALE` 을 받고, 프론트는 거기에 join 으로 답하는데, 그 join 은
 * presence 행이 없으니 `PRESENCE_NOT_CONNECTED` 로 튕긴다. 그 코드에 답이 없으면 두 코드가
 * 서로를 부르며 도는 상태가 되고, 소켓은 멀쩡히 열려 있어 stompjs 도 끼어들지 않는다.
 */
test("presence 행이 없으면 재입장이 아니라 소켓 재연결이다", () => {
  assert.equal(recoveryFor("PRESENCE_NOT_CONNECTED"), "reconnect");
  assert.notEqual(
    recoveryFor("PRESENCE_NOT_CONNECTED"),
    "rejoin",
    "join 으로는 못 고친다 — presence 행을 만드는 것은 소켓 CONNECT 뿐이다",
  );
});

test("자리가 어긋난 것뿐이면 재입장으로 맞춘다", () => {
  assert.equal(recoveryFor("PRESENCE_STALE"), "rejoin");
});

/**
 * 첫 재생 전이다. 오류가 아니라 정상 흐름이라(§3.3) 건드리면 안 된다 —
 * 재연결하면 곡을 안 튼 사용자가 탭을 열어 둔 내내 소켓을 끊었다 붙였다 하게 된다.
 */
test("재생 기록이 없는 것은 복구 대상이 아니다", () => {
  assert.equal(recoveryFor("PRESENCE_NO_ANCHOR"), "none");
});

test("모르는 코드는 아무것도 하지 않는다", () => {
  for (const code of ["PRESENCE_LAYER_INVALID", "PRESENCE_LOCATION_NULL", "RIDE_FULL", "VIEWPORT_INVALID"]) {
    assert.equal(recoveryFor(code), "none", `${code} 에 복구가 붙으면 엉뚱한 곳에서 소켓이 끊긴다`);
  }
});
