/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 개발 버전 URL 스위치 (S15P21A405-421, S15P21A405-483 에서 하나로 합침).
 *
 * 인라인 스크립트라 번들을 안 거치고 문자열로 나간다. 그래서 **문자열 그대로를 가짜 브라우저
 * 안에서 실행**해 검사한다 — 따로 옮겨 적은 사본을 재면 진짜 나가는 것과 어긋날 수 있다.
 *
 * **여기에 금지 문자열을 예시로 적지 않는다.** Tailwind 4 는 프로젝트 전체를 훑어 대괄호
 * 임의값처럼 생긴 문자열이면 주석에서도 클래스를 만들어 낸다 (S15P21A405-420 에서 겪었다).
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

test("?dev=1 이면 설문이 꺼지고 게이트를 넘는 클래스가 붙는다", () => {
  const r = run({ url: "https://ody.test/?dev=1" });
  assert.equal(r.local.get(KEY), "false");
  assert.equal(r.local.get(GATE), "false");
  assert.equal(r.dev, true);
});

test("?dev=0 은 둘 다 되돌린다 — 테스터가 보는 상태로", () => {
  const r = run({ url: "https://ody.test/?dev=0", local: { [KEY]: "false", [GATE]: "false" } });
  assert.equal(r.local.size, 0);
  assert.equal(r.dev, false);
});

test("파라미터를 주소에서 지운다 — 링크를 다시 보낼 때 딸려가지 않게", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).url, "/");
  // 남의 파라미터는 건드리지 않는다
  assert.equal(run({ url: "https://ody.test/map?dev=1&q=abc#top" }).url, "/map?q=abc#top");
});

test("파라미터 없이 다시 들어와도 유지된다 — 폰에서 한 번만 치면 된다", () => {
  const r = run({ url: "https://ody.test/", local: { [KEY]: "false", [GATE]: "false" } });
  assert.equal(r.dev, true);
  assert.equal(r.url, null, "주소를 안 건드린다");
});

test("손댄 적 없으면 아무 일도 안 한다 — 테스터가 보는 기본값", () => {
  const r = run({ url: "https://ody.test/" });
  assert.equal(r.dev, false);
  assert.equal(r.local.size, 0);
  assert.equal(r.url, null);
});

/*
 * 게이트 우회를 제 키에 담아 두는 이유는 S15P21A405-419 다 — 게이트를 걷어낼 때 지울 것이
 * 한 줄로 분명해진다. 스위치가 하나로 합쳐져도 키는 둘로 남는다.
 */
test("둘 중 하나만 꺼져 있어도 게이트는 넘는다", () => {
  assert.equal(run({ url: "https://ody.test/", local: { [GATE]: "false" } }).dev, true);
  assert.equal(run({ url: "https://ody.test/", local: { [KEY]: "false" } }).dev, true);
});

test("session 에 남은 옛 값을 지운다 — 읽는 순서 때문에 살아나지 않게", () => {
  const r = run({ url: "https://ody.test/?dev=1", session: { [KEY]: "true" } });
  assert.equal(r.session.has(KEY), false);
  assert.equal(r.local.get(KEY), "false");
});

test("저장소가 막혀 있어도 안 죽는다 — 시크릿 모드에서 앱이 뜨기 전에 터지면 안 된다", () => {
  assert.doesNotThrow(() => run({ url: "https://ody.test/?dev=1", blocked: true }));
});

test("gate 파라미터는 더 이상 아무 일도 안 한다 (S15P21A405-483)", () => {
  const r = run({ url: "https://ody.test/?gate=1" });
  assert.equal(r.local.size, 0, "저장소를 안 건드린다");
  assert.equal(r.dev, false);
  assert.equal(r.url, null, "모르는 파라미터는 주소에 그대로 둔다");
});
