/* eslint-disable @typescript-eslint/no-require-imports */
// 새로고침 너머로 들고 가는 쿼리 캐시 (S15P21A405-504).
// 무엇을 담고 무엇을 안 담는지, 언제 버리는지가 이 파일이 지키는 것이다 —
// 남의 프로필이 되살아나거나 하루 지난 숫자를 사실처럼 띄우면 이 기능은 없느니만 못하다.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { QueryClient } = require("@tanstack/react-query");

// storage.ts 는 window 를 본다. 노드에는 없으므로 최소한의 저장소를 세운다
const store = new Map();
const fake = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage: fake, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };

const { STORAGE_KEYS } = require("../src/constants/storage-keys.ts");
const { QUERY_KEYS } = require("../src/constants/query-keys.ts");
const { startQueryPersist, clearPersistedQueries } = require("../src/lib/query-persist.ts");

const TOKEN = STORAGE_KEYS.accessToken;
const CACHE = STORAGE_KEYS.queryCache;
const saved = () => (store.has(CACHE) ? JSON.parse(store.get(CACHE)) : null);
const savedKeys = () => (saved()?.state.queries ?? []).map((q) => q.queryKey.join("/"));
/** 저장은 1초 묶음이라 기다렸다 본다 */
const settle = () => new Promise((r) => setTimeout(r, 1100));

function login() {
  store.set(TOKEN, JSON.stringify("token"));
}
function fill(client) {
  client.setQueryData(QUERY_KEYS.auth.me, { email: "me@ody.kr", nickname: "루나" });
  client.setQueryData(QUERY_KEYS.user.profile("me@ody.kr"), { nickname: "루나", followerCount: 7, isOnline: true });
  client.setQueryData(QUERY_KEYS.playlist.mine, [{ id: 1, playlistName: "밤" }]);
  client.setQueryData(QUERY_KEYS.map.songs([{ layer: 1, xMin: 0, yMin: 0, xMax: 1, yMax: 1 }]), [{ musicId: 1 }]);
  client.setQueryData(QUERY_KEYS.music.search({ mode: "all", query: "aespa" }), []);
}

beforeEach(() => store.clear());

test("저장 대상만 담긴다 — 지도 상주 집합과 검색 결과는 새로고침을 넘기지 않는다", async () => {
  login();
  const client = new QueryClient();
  const stop = startQueryPersist(client);
  fill(client);
  await settle();
  stop();

  const keys = savedKeys();
  assert.ok(keys.some((k) => k.startsWith("auth/me")), "내 정보는 담긴다");
  assert.ok(keys.some((k) => k.startsWith("user/profile")), "프로필은 담긴다");
  assert.ok(keys.some((k) => k.startsWith("playlist/mine")), "내 플리는 담긴다");
  assert.ok(!keys.some((k) => k.startsWith("map/songs")), "지도 상주 집합은 담지 않는다 — 용량이 크다");
  assert.ok(!keys.some((k) => k.startsWith("music/search")), "검색 결과는 담지 않는다");
});

test("새로고침하면 지난 값이 먼저 들어와 있다 — 요청을 기다리지 않는다", async () => {
  login();
  const before = new QueryClient();
  const stop = startQueryPersist(before);
  fill(before);
  await settle();
  stop();

  // 새로고침 = 메모리를 버리고 처음부터
  const after = new QueryClient();
  const stop2 = startQueryPersist(after);
  assert.equal(after.getQueryData(QUERY_KEYS.auth.me).nickname, "루나");
  assert.equal(after.getQueryData(QUERY_KEYS.user.profile("me@ody.kr")).followerCount, 7);
  stop2();
});

test("하루가 지난 값은 버린다 — 옛 숫자를 사실처럼 띄우지 않는다", () => {
  login();
  const stale = { savedAt: Date.now() - 25 * 60 * 60 * 1000, state: { mutations: [], queries: [{ queryKey: QUERY_KEYS.auth.me, queryHash: '["auth","me"]', state: { data: { nickname: "옛날" }, dataUpdatedAt: 1, status: "success", fetchStatus: "idle" } }] } };
  store.set(CACHE, JSON.stringify(stale));

  const client = new QueryClient();
  const stop = startQueryPersist(client);
  assert.equal(client.getQueryData(QUERY_KEYS.auth.me), undefined);
  assert.equal(store.has(CACHE), false, "버린 값은 저장소에서도 지운다");
  stop();
});

test("토큰이 없으면 붓지 않고 지운다 — 세션만 끊겨도 남의 프로필이 되살아나면 안 된다", () => {
  store.set(CACHE, JSON.stringify({ savedAt: Date.now(), state: { mutations: [], queries: [{ queryKey: QUERY_KEYS.auth.me, queryHash: '["auth","me"]', state: { data: { nickname: "남" }, dataUpdatedAt: Date.now(), status: "success", fetchStatus: "idle" } }] } }));

  const client = new QueryClient();
  const stop = startQueryPersist(client);
  assert.equal(client.getQueryData(QUERY_KEYS.auth.me), undefined);
  assert.equal(store.has(CACHE), false);
  stop();
});

test("로그아웃이 부르는 지우개는 저장소를 비운다", async () => {
  login();
  const client = new QueryClient();
  const stop = startQueryPersist(client);
  fill(client);
  await settle();
  assert.ok(store.has(CACHE));

  stop();
  clearPersistedQueries();
  assert.equal(store.has(CACHE), false);
});
