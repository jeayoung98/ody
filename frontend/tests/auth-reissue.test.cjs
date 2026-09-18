/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **죽은 토큰이 언제 지워지는가** (S15P21A405-473).
 *
 * 재발급이 실패해도 토큰이 남아 있으면 `AuthGuard` 가 계속 "로그인됨" 으로 읽어서,
 * 로그아웃을 직접 누르기 전까지 401 만 받는 홈에 머문다. 반대로 네트워크가 끊겼을 뿐인데
 * 지워버리면 와이파이가 돌아와도 다시 로그인해야 한다. 두 경우를 여기서 갈라 둔다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

/** 저장소는 `window` 를 호출 시점에 본다 — import 전에 심어 두면 된다 */
function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
globalThis.window = { localStorage: memStorage(), sessionStorage: memStorage() };

const { api } = require("../src/lib/api.ts");
const { readStorage, writeStorage, subscribeStorage } = require("../src/lib/storage.ts");
const { STORAGE_KEYS, API_ENDPOINTS } = require("../src/constants/index.ts");

const TOKEN = STORAGE_KEYS.accessToken;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const unauthorized = () => json(401, { success: false, error: { code: "UNAUTHORIZED", message: "만료" } });

/** 요청을 가로채 경로별로 답을 준다. 재발급 경로의 동작은 테스트마다 다르다 */
function stubFetch(onReissue) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const path = String(url);
    calls.push(path);
    if (path.includes(API_ENDPOINTS.auth.reissue)) return onReissue();
    return unauthorized();
  };
  return calls;
}

test("재발급이 401 로 끝나면 죽은 토큰을 지운다", async () => {
  writeStorage(TOKEN, "expired-token");
  const calls = stubFetch(() => unauthorized());

  await assert.rejects(() => api(API_ENDPOINTS.auth.me));

  // 재발급을 한 번은 시도했다 — 만료를 알아서 파악하고 되살려보긴 해야 한다
  assert.ok(calls.some((c) => c.includes(API_ENDPOINTS.auth.reissue)));
  // 그리고 실패했으면 남기지 않는다. 남으면 AuthGuard 가 로그인으로 보내지 못한다
  assert.equal(readStorage(TOKEN), null);
});

test("네트워크가 끊겨 재발급을 못 보낸 것이면 토큰을 지킨다", async () => {
  writeStorage(TOKEN, "maybe-alive");
  stubFetch(() => {
    throw new TypeError("Failed to fetch");
  });

  await assert.rejects(() => api(API_ENDPOINTS.auth.me));

  assert.equal(readStorage(TOKEN), "maybe-alive");
});

test("토큰이 지워지면 구독자가 그 자리에서 듣는다", () => {
  writeStorage(TOKEN, "alive");
  let heard = 0;
  const unsubscribe = subscribeStorage(() => (heard += 1));

  writeStorage(TOKEN, "renewed");
  assert.equal(heard, 1);

  unsubscribe();
  writeStorage(TOKEN, "again");
  assert.equal(heard, 1, "구독을 끊었으면 더 듣지 않는다");
});
