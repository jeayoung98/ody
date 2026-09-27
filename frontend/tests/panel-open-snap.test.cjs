/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 여는 단을 부르는 쪽이 정한다 (S15P21A405-712). 폰 윗줄의 여정 버튼·경로 만들기는 1 단을 주고,
 * 안 주는 길(레일·재생바·뒤로가기)은 예전처럼 여는 자리(2 단)에 선다.
 * 브라우저 저장소 경계만 가짜고 스토어는 실제 모듈이다.
 */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

let panel;

beforeEach(() => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  global.window = { localStorage: storage, sessionStorage: { ...storage, removeItem: () => {} } };
  ({ usePanelStore: panel } = require("../src/stores/use-panel-store.ts"));
  panel.setState(panel.getInitialState(), true);
});
afterEach(() => {
  delete global.window;
});

test("단을 안 주면 여는 자리(2 단)에 선다 — 레일·재생바는 그대로다", () => {
  panel.getState().toggle("journey");
  assert.equal(panel.getState().activePanel, "journey");
  assert.equal(panel.getState().snap, 2);

  panel.getState().close();
  panel.getState().openJourney();
  assert.equal(panel.getState().snap, 2);
});

test("폰 윗줄 여정 버튼은 1 단으로 연다", () => {
  panel.getState().toggle("journey", 1);
  assert.equal(panel.getState().activePanel, "journey");
  assert.equal(panel.getState().snap, 1);
});

test("경로 만들기 뒤 폰은 1 단으로 연다", () => {
  panel.getState().openJourney(1);
  assert.equal(panel.getState().activePanel, "journey");
  assert.equal(panel.getState().snap, 1);
});

test("다른 패널이 3 단으로 떠 있어도 1 단으로 갈아탄다", () => {
  panel.getState().openChart();
  panel.getState().setSnap(3);
  panel.getState().toggle("journey", 1);
  assert.equal(panel.getState().activePanel, "journey");
  assert.equal(panel.getState().snap, 1);
});

test("이미 떠 있는 패널을 다시 누르면 단과 상관없이 닫힌다", () => {
  panel.getState().toggle("journey", 1);
  panel.getState().toggle("journey", 1);
  assert.equal(panel.getState().activePanel, null);
});

test("프로필 토글도 단을 받는다 — 내 프로필로 연다", () => {
  panel.getState().toggle("feed", 1);
  assert.equal(panel.getState().activePanel, "feed");
  assert.equal(panel.getState().profileEmail, null);
  assert.equal(panel.getState().snap, 1);
});
