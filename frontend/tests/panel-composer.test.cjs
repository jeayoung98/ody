/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 검색창과 사이드 패널은 함께 뜨지 않는다 (JOURNEY-01 · S15P21A405-390).
 * 브라우저 저장소 경계만 가짜고 스토어는 실제 모듈이다.
 */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

let panel, journey;

beforeEach(() => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  global.window = { localStorage: storage, sessionStorage: { ...storage, removeItem: () => {} } };
  ({ usePanelStore: panel } = require("../src/stores/use-panel-store.ts"));
  ({ useJourneyStore: journey } = require("../src/stores/use-journey-store.ts"));
  panel.setState(panel.getInitialState(), true);
  journey.setState(journey.getInitialState(), true);
});
afterEach(() => {
  delete global.window;
});

/** 패널을 여는 길은 레일 말고도 있다 — 전부 같은 규칙을 따라야 한다 */
const OPENERS = [
  ["openChart", () => panel.getState().openChart(), "chart"],
  ["openFeed", () => panel.getState().openFeed(), "feed"],
  ["openFriends", () => panel.getState().openFriends(), "friends"],
  ["openPlaylist", () => panel.getState().openPlaylist(1), "playlist"],
  ["openSong (지도에서 별 클릭)", () => panel.getState().openSong(7), "song"],
  ["toggle (레일 버튼)", () => panel.getState().toggle("chart"), "chart"],
];

for (const [name, openPanel, expected] of OPENERS) {
  test(`${name} 로 패널을 열면 여정 검색창이 닫힌다`, () => {
    journey.getState().openComposer();
    assert.equal(journey.getState().isComposerOpen, true);

    openPanel();

    assert.equal(journey.getState().isComposerOpen, false, "검색창이 패널과 같이 떠 있으면 안 된다");
    assert.equal(panel.getState().activePanel, expected);
  });
}

test("검색창이 안 떠 있으면 패널을 열어도 여정 상태를 건드리지 않는다", () => {
  journey.getState().setStart(3);
  const before = journey.getState().pickTarget;
  panel.getState().openChart();
  assert.equal(journey.getState().isComposerOpen, false);
  assert.equal(journey.getState().startMusicId, 3, "고른 지점이 날아가면 안 된다");
  assert.equal(journey.getState().pickTarget, before);
});

test("패널을 닫는 것은 검색창을 건드리지 않는다 — 겹치지 않으니 끌 이유가 없다", () => {
  panel.getState().openChart();
  journey.getState().openComposer();
  panel.getState().close();
  assert.equal(journey.getState().isComposerOpen, true);
  assert.equal(panel.getState().activePanel, null);
});
