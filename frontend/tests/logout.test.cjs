/* eslint-disable @typescript-eslint/no-require-imports */
// 로그아웃 (S15P21A405-588).
// 이 기능이 지키는 것은 **순서**다. 서버를 기다리면 화면이 멈추고, 저장소를 먼저 비우면
// 요청이 토큰을 못 읽고, 재발급 결과를 저장하면 방금 로그아웃한 사람이 되살아난다.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { runLogout, endServerSession } = require("../src/hooks/mutations/use-logout-mutation.ts");
const { API_ENDPOINTS } = require("../src/constants/api-endpoints.ts");

const res = (status, body) => ({ status, json: async () => body });

test("서버 응답을 기다리지 않는다 — 끝나지 않는 요청이어도 로컬은 즉시 비워진다", () => {
  let cleared = false;
  runLogout({
    readToken: () => "T",
    endSession: () => new Promise(() => {}), // 영영 안 끝난다
    clearLocal: () => {
      cleared = true;
    },
  });
  assert.equal(cleared, true, "요청이 걸려 있어도 로그아웃은 이미 끝나 있어야 한다");
});

test("토큰을 먼저 들고 나온다 — 비운 뒤에 읽으면 요청에 실을 것이 없다", () => {
  const order = [];
  let sent;
  runLogout({
    readToken: () => {
      order.push("read");
      return "T";
    },
    endSession: async (t) => {
      sent = t;
    },
    clearLocal: () => order.push("clear"),
  });
  assert.deepEqual(order, ["read", "clear"]);
  assert.equal(sent, "T");
});

test("만료된 토큰이면 재발급받아 한 번 더 끊는다 — refresh 쿠키가 남으면 안 된다", async () => {
  const calls = [];
  const fake = async (url, init) => {
    calls.push([url, init?.headers?.Authorization ?? null]);
    if (url === API_ENDPOINTS.auth.reissue) return res(200, { success: true, data: { accessToken: "NEW" }, error: null });
    return res(calls.length === 1 ? 401 : 200, null);
  };
  await endServerSession("OLD", fake);
  assert.deepEqual(calls, [
    [API_ENDPOINTS.auth.logout, "Bearer OLD"],
    [API_ENDPOINTS.auth.reissue, null],
    [API_ENDPOINTS.auth.logout, "Bearer NEW"],
  ]);
});

test("멀쩡한 토큰이면 한 번만 부른다 — 쓸데없이 재발급하지 않는다", async () => {
  const calls = [];
  await endServerSession("OK", async (url) => {
    calls.push(url);
    return res(200, null);
  });
  assert.deepEqual(calls, [API_ENDPOINTS.auth.logout]);
});

test("재발급이 실패하면 거기서 끝난다 — 화면은 이미 로그아웃이라 알릴 것이 없다", async () => {
  const calls = [];
  await endServerSession("OLD", async (url) => {
    calls.push(url);
    if (url === API_ENDPOINTS.auth.reissue) return res(401, { success: false, data: null, error: { code: "REFRESH_TOKEN_MISMATCH", message: "" } });
    return res(401, null);
  });
  assert.deepEqual(calls, [API_ENDPOINTS.auth.logout, API_ENDPOINTS.auth.reissue]);
});

test("네트워크가 끊겨도 던지지 않는다 — 아무도 받아 줄 사람이 없다", async () => {
  await endServerSession("T", async () => {
    throw new Error("network down");
  });
});
