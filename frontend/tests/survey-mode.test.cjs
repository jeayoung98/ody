/* eslint-disable @typescript-eslint/no-require-imports */
/** 설문 모드 스위치 (S15P21A405-383). 브라우저 저장소 경계만 가짜고 나머지는 실제 모듈이다. */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const KEY = "ody:survey-mode";
let values;

/** 새 env 로 모듈을 다시 읽는다 — TEST_TOOLS 는 모듈이 처음 불릴 때 한 번 정해진다 */
function loadFresh(testTools) {
  for (const file of ["src/hooks/use-survey-mode.ts", "src/constants/test-tools.ts"]) {
    delete require.cache[path.resolve(__dirname, "..", file)];
  }
  if (testTools === undefined) delete process.env.NEXT_PUBLIC_TEST_TOOLS;
  else process.env.NEXT_PUBLIC_TEST_TOOLS = testTools;
  return require("../src/hooks/use-survey-mode.ts");
}

beforeEach(() => {
  values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  global.window = { localStorage: storage, sessionStorage: { ...storage, removeItem: () => {} } };
});
afterEach(() => {
  delete global.window;
  delete process.env.NEXT_PUBLIC_TEST_TOOLS;
});

test("값이 없으면 설문 모드다 — 테스터가 손대지 않은 상태", () => {
  assert.equal(loadFresh().surveyModeEnabled(), true);
});

test('"false" 면 꺼지고 "true" 로 되돌아온다', () => {
  const { surveyModeEnabled } = loadFresh();
  values.set(KEY, "false");
  assert.equal(surveyModeEnabled(), false);
  values.set(KEY, "true");
  assert.equal(surveyModeEnabled(), true);
});

test("빌드 스위치가 이긴다 — TEST_TOOLS=0 이면 로컬 값으로 못 켠다", () => {
  const { surveyModeEnabled } = loadFresh("0");
  assert.equal(surveyModeEnabled(), false);
  values.set(KEY, "true");
  assert.equal(surveyModeEnabled(), false);
});

test("망가진 값·막힌 저장소는 기본값으로 떨어진다 — 시크릿 모드에서도 설문이 돈다", () => {
  const { surveyModeEnabled } = loadFresh();
  values.set(KEY, "부서진 값");
  assert.equal(surveyModeEnabled(), true);
  window.localStorage.getItem = () => {
    throw new Error("blocked");
  };
  window.sessionStorage.getItem = () => {
    throw new Error("blocked");
  };
  assert.equal(surveyModeEnabled(), true);
});

test("서버 스냅샷은 빌드 기본값이다 — 하이드레이션 첫 렌더가 서버와 같아야 한다", () => {
  // 서버에는 window 가 없다. 그 상태에서 읽는 값이 useSyncExternalStore 의 getServerSnapshot 과 같아야
  // 첫 클라이언트 렌더가 서버 HTML 과 일치한다.
  delete global.window;
  assert.equal(loadFresh().surveyModeEnabled(), true);
  assert.equal(loadFresh("0").surveyModeEnabled(), false);
});
