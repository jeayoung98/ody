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
const { readStorage, writeStorage, removeStorage, resyncStorage, subscribeStorage } = require("../src/lib/storage.ts");
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

/**
 * 재발급이 도는 **사이에** 로그아웃한 경우 (S15P21A405-588).
 *
 * 지도는 10초마다 겹 사용자를 폴링하고 액세스 토큰 수명은 30분이라, 로그아웃을 누르는 순간
 * 401 재발급이 떠 있을 확률이 낮지 않다. 그때 새 토큰을 써 넣으면 방금 로그아웃한 사람이
 * 다시 로그인되고, 로그인 화면은 스플래시만 띄운 채 홈으로 되돌린다.
 */
test("재발급 도중에 로그아웃했으면 새 토큰을 쓰지 않는다", async () => {
  // 앞 테스트의 재발급 메모(`reissuing`)가 비워지도록 한 박자 넘긴다 — 그 정리가 매크로태스크다
  await new Promise((r) => setTimeout(r, 0));
  writeStorage(TOKEN, "expired-token");
  stubFetch(async () => {
    // 재발급 응답이 오기 직전에 로그아웃이 끼어든다
    removeStorage(TOKEN);
    return json(200, { success: true, data: { accessToken: "revived" }, error: null });
  });

  await assert.rejects(() => api(API_ENDPOINTS.auth.me));

  assert.equal(readStorage(TOKEN), null, "로그아웃한 세션이 재발급으로 되살아나면 안 된다");
});

test("로그아웃하지 않았으면 새 토큰을 그대로 받는다", async () => {
  // 앞 테스트의 재발급 메모(`reissuing`)가 비워지도록 한 박자 넘긴다 — 그 정리가 매크로태스크다
  await new Promise((r) => setTimeout(r, 0));
  writeStorage(TOKEN, "expired-token");
  stubFetch(async () => json(200, { success: true, data: { accessToken: "revived" }, error: null }));

  await assert.rejects(() => api(API_ENDPOINTS.auth.me));

  assert.equal(readStorage(TOKEN), "revived");
});

/**
 * 어긋난 구독 값을 깨우는 길 (S15P21A405-588).
 *
 * `useSyncExternalStore` 는 알림이 와야 스냅샷을 다시 읽는다. 하이드레이션 때 "토큰 없음" 으로
 * 커밋되고 나면 그 뒤로 저장소를 건드리는 사람이 없어 영영 어긋난 채 남았다 — 로그인해도
 * 스플래시만 돌고 새로고침해야 지도가 떴다.
 */
test("resyncStorage 는 값을 안 바꾸고 구독자만 깨운다", () => {
  writeStorage(TOKEN, "alive");
  let heard = 0;
  const unsubscribe = subscribeStorage(() => (heard += 1));

  resyncStorage();
  assert.equal(heard, 1, "구독자가 다시 읽을 기회를 받아야 한다");
  assert.equal(readStorage(TOKEN), "alive", "저장소는 그대로여야 한다");

  unsubscribe();
});
