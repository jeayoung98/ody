/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { useTutorialStore: tutorial } = require("../src/stores/use-tutorial-store.ts");
const { STORAGE_KEYS, TUTORIAL_STEPS } = require("../src/constants/index.ts");
let values;
beforeEach(() => {
  values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  // Only the browser storage boundary is faked. Store and storage wrapper are real.
  global.window = { localStorage: storage, sessionStorage: { ...storage, removeItem: () => {} } };
  tutorial.setState(tutorial.getInitialState(), true);
});
afterEach(() => { delete global.window; });
test("skip persists done and restores it after a full reload", () => {
  tutorial.getState().skip();
  assert.equal(values.get(STORAGE_KEYS.tutorialDone), "true");
  tutorial.setState(tutorial.getInitialState(), true);
  assert.equal(tutorial.getState().isDone, false);
  assert.equal(tutorial.getState().hydrateCompletion(), true);
  assert.equal(tutorial.getState().isDone, true);
});
test("all tutorial steps use the same persisted completion path", () => {
  for (const step of TUTORIAL_STEPS) tutorial.getState().complete(step.task);
  assert.equal(tutorial.getState().isDone, true);
  assert.equal(values.get(STORAGE_KEYS.tutorialDone), "true");
});
test("local done wins over missing or stale server state", () => {
  values.set(STORAGE_KEYS.tutorialDone, "true");
  assert.equal(tutorial.getState().hydrateCompletion(false), true);
});
test("server completion is restored and saved locally", () => {
  assert.equal(tutorial.getState().hydrateCompletion(true), true);
  assert.equal(values.get(STORAGE_KEYS.tutorialDone), "true");
});
test("replaying tutorial resets steps, not persisted completion", () => {
  tutorial.getState().skip(); tutorial.getState().reset();
  assert.equal(tutorial.getState().isDone, false);
  assert.equal(tutorial.getState().hydrateCompletion(), true);
});
test("absent or corrupt storage does not claim tutorial completion", () => {
  assert.equal(tutorial.getState().hydrateCompletion(), false);
  values.set(STORAGE_KEYS.tutorialDone, "false"); assert.equal(tutorial.getState().hydrateCompletion(), false);
  values.set(STORAGE_KEYS.tutorialDone, "broken"); assert.equal(tutorial.getState().hydrateCompletion(), false);
});
test("blocked storage still allows completion in the current page", () => {
  window.localStorage.setItem = () => { throw new Error("blocked"); };
  tutorial.getState().skip(); assert.equal(tutorial.getState().isDone, true);
});
