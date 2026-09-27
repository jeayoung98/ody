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

const { devModeScript } = require("../src/constants/dev-mode.ts");
const { STORAGE_KEYS } = require("../src/constants/storage-keys.ts");

const KEY = STORAGE_KEYS.surveyMode;
const ANALYTICS = STORAGE_KEYS.analyticsMode;

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
    classes,
    local: context.localStorage.values,
    session: context.sessionStorage.values,
    url: replaced.at(-1) ?? null,
  };
}

test("?dev=1 이면 설문이 꺼진다", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).local.get(KEY), "false");
});

/*
 * 좁은 화면 게이트가 없어지면서(S15P21A405-419) 이 스크립트가 <html> 에 클래스를 붙이던 일도
 * 같이 사라졌다. 남은 일은 저장소 키 둘(설문·분석)을 뒤집는 것뿐이다.
 */
test("<html> 에 아무 클래스도 안 붙인다 — 게이트가 없어졌다", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).classes.size, 0);
  assert.equal(run({ url: "https://ody.test/" }).classes.size, 0);
});

/*
 * 분석도 같이 끈다 — 우리가 만지는 것이 테스터 데이터에 섞이면 안 된다. 브라우저별 스위치는
 * 원래 있었지만 콘솔에서만 넣을 수 있었고, 폰에는 콘솔이 없다.
 */
test("?dev=1 이면 이 브라우저의 분석 전송이 멈춘다", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).local.get(ANALYTICS), "false");
});

test("?dev=0 이면 분석이 다시 켜진다 — 껐다면 되돌릴 수도 있어야 한다", () => {
  const r = run({ url: "https://ody.test/?dev=0", local: { [ANALYTICS]: "false" } });
  assert.equal(r.local.has(ANALYTICS), false);
});

test("?dev=0 은 테스터가 보는 상태로 — 설문을 켜고 분석은 다시 보낸다 (S15P21A405-696)", () => {
  const r = run({ url: "https://ody.test/?dev=0", local: { [KEY]: "false", [ANALYTICS]: "false" } });
  // 설문 기본이 꺼짐이라 지우면 설문이 안 뜬다 — 켜서 넣는다
  assert.equal(r.local.get(KEY), "true");
  assert.equal(r.local.has(ANALYTICS), false);
});

test("파라미터를 주소에서 지운다 — 링크를 다시 보낼 때 딸려가지 않게", () => {
  assert.equal(run({ url: "https://ody.test/?dev=1" }).url, "/");
  // 남의 파라미터는 건드리지 않는다
  assert.equal(run({ url: "https://ody.test/map?dev=1&q=abc#top" }).url, "/map?q=abc#top");
});

test("파라미터 없이 다시 들어와도 유지된다 — 폰에서 한 번만 치면 된다", () => {
  const r = run({ url: "https://ody.test/", local: { [KEY]: "false" } });
  assert.equal(r.local.get(KEY), "false", "손대지 않는다");
  assert.equal(r.url, null, "주소를 안 건드린다");
});

test("손댄 적 없으면 아무 일도 안 한다 — 기본값(설문 꺼짐) 그대로", () => {
  const r = run({ url: "https://ody.test/" });
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

test("gate 파라미터는 더 이상 아무 일도 안 한다 (S15P21A405-483)", () => {
  const r = run({ url: "https://ody.test/?gate=1" });
  assert.equal(r.local.size, 0, "저장소를 안 건드린다");
  assert.equal(r.url, null, "모르는 파라미터는 주소에 그대로 둔다");
});
