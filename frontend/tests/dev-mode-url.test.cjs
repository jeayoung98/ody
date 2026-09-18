/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 개발 버전 URL 스위치 (S15P21A405-421).
 *
 * 인라인 스크립트라 번들을 안 거치고 문자열로 나간다. 그래서 **문자열 그대로를 가짜 브라우저
 * 안에서 실행**해 검사한다 — 따로 옮겨 적은 사본을 재면 진짜 나가는 것과 어긋날 수 있다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const { devModeScript, DEV_MODE_CLASS } = require("../src/constants/dev-mode.ts");
const { STORAGE_KEYS } = require("../src/constants/storage-keys.ts");

const KEY = STORAGE_KEYS.surveyMode;
const GATE = STORAGE_KEYS.gateOff;

/** 저장소 한 칸. `blocked` 면 시크릿 모드처럼 모든 접근이 던진다 */
function makeStorage(initial = {}, blocked = false) {
  const values = new Map(Object.entries(initial));
  const guard = () => {
    if (blocked) throw new Error("blocked");
  };
  return {
    values,
    getItem: (k) => (guard(), values.get(k) ?? null),
    setItem: (k, v) => (guard(), values.set(k, v), undefined),
    removeItem: (k) => (guard(), values.delete(k), undefined),
  };
}

/** 스크립트를 한 번 돌리고 그 뒤의 브라우저 상태를 돌려준다 */
function run({ url = "https://ody.test/", local = {}, session = {}, blocked = false } = {}) {
  const classes = new Set();
  const replaced = [];
  const context = {
    URL,
    URLSearchParams,
    location: { href: url },
    localStorage: makeStorage(local, blocked),
    sessionStorage: makeStorage(session, blocked),
    history: { replaceState: (_s, _t, next) => replaced.push(next) },
    document: {
      documentElement: {
        classList: {
          toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(devModeScript, context);
  return {
    dev: classes.has(DEV_MODE_CLASS),
    local: context.localStorage.values,
    session: context.sessionStorage.values,
    url: replaced.at(-1) ?? null,
  };
}

test("?dev=1 이면 설문 모드를 끄고 게이트를 넘는 클래스가 붙는다", () => {
  const r = run({ url: "https://ody.test/?dev=1" });
  assert.equal(r.local.get(KEY), "false");
  assert.equal(r.dev, true);
});

test("파라미터를 주소에서 지운다 — 링크를 다시 보낼 때 딸려가지 않게", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).url, "/");
  // 남의 파라미터는 건드리지 않는다
  assert.equal(run({ url: "https://ody.test/map?dev=1&q=abc#top" }).url, "/map?q=abc#top");
});

test("?dev=0 이면 설문 모드로 돌아가고 게이트도 살아난다", () => {
  const r = run({ url: "https://ody.test/?dev=0", local: { [KEY]: "false" } });
  assert.equal(r.local.has(KEY), false);
  assert.equal(r.dev, false);
});

test("파라미터 없이 다시 들어와도 유지된다 — 폰에서 한 번만 치면 된다", () => {
  const r = run({ url: "https://ody.test/", local: { [KEY]: "false" } });
  assert.equal(r.dev, true);
  assert.equal(r.url, null, "주소를 안 건드린다");
});

test("손댄 적 없으면 아무 일도 안 한다 — 테스터가 보는 기본값", () => {
  const r = run({ url: "https://ody.test/" });
  assert.equal(r.dev, false);
  assert.equal(r.local.size, 0);
  assert.equal(r.url, null);
});

test("session 에 남은 옛 값을 지운다 — 읽는 순서 때문에 살아나지 않게", () => {
  const r = run({ url: "https://ody.test/?dev=1", session: { [KEY]: "true" } });
  assert.equal(r.session.has(KEY), false);
  assert.equal(r.local.get(KEY), "false");
});

test("저장소가 막혀 있어도 안 죽는다 — 시크릿 모드에서 앱이 뜨기 전에 터지면 안 된다", () => {
  assert.doesNotThrow(() => run({ url: "https://ody.test/?dev=1", blocked: true }));
});

/*
 * 스위치가 둘인 이유는 로그인이다 — 설문 모드를 끄면 로그인 게이트가 살아난다
 * (S15P21A405-459). 폰에서 레이아웃만 보려는데 매번 로그인하게 두지 않으려고 게이트만
 * 따로 넘는 길을 뒀다.
 */

test("?dev=1 은 설문 모드와 게이트를 한꺼번에 뒤집는다", () => {
  const r = run({ url: "https://ody.test/?dev=1" });
  assert.equal(r.local.get(KEY), "false");
  assert.equal(r.local.get(GATE), "false");
  assert.equal(r.dev, true);
});

test("?gate=1 은 게이트만 넘는다 — 설문 모드가 살아 있어야 로그인 없이 본다", () => {
  const r = run({ url: "https://ody.test/?gate=1" });
  assert.equal(r.local.has(KEY), false, "설문 모드를 건드리면 로그인 화면으로 튕긴다");
  assert.equal(r.local.get(GATE), "false");
  assert.equal(r.dev, true, "게이트는 넘는다");
});

test("?gate=0 으로 게이트만 되돌려도 개발 버전은 남는다", () => {
  const r = run({ url: "https://ody.test/?gate=0", local: { [KEY]: "false", [GATE]: "false" } });
  assert.equal(r.local.get(KEY), "false", "개발 버전은 그대로");
  assert.equal(r.local.has(GATE), false);
  assert.equal(r.dev, true, "설문 모드가 꺼져 있으면 그것만으로도 게이트를 넘는다");
});

test("?dev=0 은 둘 다 되돌린다 — 테스터가 보는 상태로", () => {
  const r = run({ url: "https://ody.test/?dev=0", local: { [KEY]: "false", [GATE]: "false" } });
  assert.equal(r.local.size, 0);
  assert.equal(r.dev, false);
});

test("두 파라미터를 같이 줘도 둘 다 지우고 한 번만 주소를 고친다", () => {
  const r = run({ url: "https://ody.test/?dev=1&gate=0&q=x" });
  assert.equal(r.url, "/?q=x");
  assert.equal(r.local.get(KEY), "false");
  assert.equal(r.local.has(GATE), false, "뒤에 온 gate=0 이 이긴다");
});
