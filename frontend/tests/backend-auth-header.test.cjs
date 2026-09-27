/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **백엔드에 어느 토큰을 붙이는가** (S15P21A405-481).
 *
 * 로그인이 항상 필수가 되면서(S15P21A405-480) BFF 라우트를 부르는 사람은 언제나 로그인한
 * 사람이다. 그런데도 서버 전용 토큰으로 계속 부르면 백엔드 로그에서 **전원이 한 사람**으로
 * 보이고, 그 토큰이 만료되는 날 조용히 전부 401 이 된다.
 *
 * 우선순위가 뒤집혀도 배포 백엔드를 실제로 불러 보기 전에는 모르는 종류의 실수라, 여기서
 * 고정한다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { authHeader } = require("../src/lib/backend.ts");

const SERVICE = "svc-token";
const CALLER = "Bearer caller-token";

test("호출자 토큰이 있으면 그것을 쓴다 — 서비스 토큰이 있어도", () => {
  assert.deepEqual(authHeader(CALLER, SERVICE), { Authorization: CALLER });
});

test("호출자 토큰이 없으면 서비스 토큰으로 떨어진다 — 예전 동작", () => {
  assert.deepEqual(authHeader(null, SERVICE), { Authorization: `Bearer ${SERVICE}` });
  assert.deepEqual(authHeader(undefined, SERVICE), { Authorization: `Bearer ${SERVICE}` });
  // 빈 문자열은 "못 읽었다" 와 같다 — 헤더가 비어 온 요청을 로그인으로 치지 않는다
  assert.deepEqual(authHeader("", SERVICE), { Authorization: `Bearer ${SERVICE}` });
});

test("둘 다 없으면 헤더를 안 붙인다 — A-17 해제 중에는 그래도 조회가 된다", () => {
  assert.deepEqual(authHeader(null, undefined), {});
});

test("호출자 토큰에 Bearer 를 덧붙이지 않는다 — 브라우저가 이미 붙여 보낸다", () => {
  assert.equal(authHeader(CALLER, SERVICE).Authorization, "Bearer caller-token");
  assert.ok(!authHeader(CALLER, SERVICE).Authorization.startsWith("Bearer Bearer"));
});
