/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { usePlayerStore: player } = require("../src/stores/use-player-store.ts");
const { useBlockingStore: blocking, runPlaybackTransition } = require("../src/stores/use-blocking-store.ts");
const { ownedMapRepresentation, playbackActivity, shouldConfirmListExit, visiblePlayContext } = require("../src/lib/play-context.ts");
const { useMapStore: map } = require("../src/stores/use-map-store.ts");
beforeEach(() => { blocking.setState(blocking.getInitialState(), true); player.setState(player.getInitialState(), true); map.setState(map.getInitialState(), true); });
test("no optional adapter: single, queue, previous, next, end and stop work", () => {
  const p = player.getState;
  p().playSingle(1); assert.equal(p().isPlaying, true);
  p().playQueue({ kind: "playlist", playlistId: 9 }, [1, 2]); p().next();
  assert.equal(p().currentMusicId, 2); p().prev(); assert.equal(p().currentMusicId, 1);
  p().next(); p().next(); assert.equal(p().isPlaying, false);
  p().stop(); assert.equal(p().currentMusicId, null);
});
test("invalid queue indices leave current playback unchanged", () => {
  player.getState().playSingle(1);
  for (const index of [-1, 2, 0.5]) player.getState().playQueue({ kind: "playlist", playlistId: 1 }, [2], index);
  assert.equal(player.getState().currentMusicId, 1);
});
test("one deferred activity commits nested actions and effects once", () => {
  let resume, calls = 0, effects = 0;
  blocking.getState().setGate((callback) => { calls++; resume = callback; return true; });
  runPlaybackTransition(() => { player.getState().stop(); player.getState().playSingle(3); effects++; });
  assert.equal(effects, 0); resume(); resume();
  assert.equal(calls, 1); assert.equal(effects, 1); assert.equal(player.getState().currentMusicId, 3);
});
test("manual nearby picks stay in the same exploration without a leave-list confirmation", () => {
  const nearby = { kind: "nearby", centerMusicId: 10 };
  assert.equal(shouldConfirmListExit(nearby, [], 12, nearby), false);
  assert.deepEqual(playbackActivity(nearby, 0), { kind: "nearby", targetKey: "10" });
  player.getState().playSingle(11, nearby);
  player.getState().playSingle(12, nearby);
  assert.deepEqual(player.getState().context, nearby);
  assert.deepEqual(player.getState().queue, []);
});
test("only the stopped activity owns and may clear its map representation", () => {
  const oldNearby = { kind: "nearby", targetKey: "10" };
  const newJourney = { kind: "journey", startMusicId: 20, endMusicId: 30 };
  assert.equal(ownedMapRepresentation({
    viewMode: "constellation", nearbyCenterMusicId: null, constellationSource: newJourney,
  }, oldNearby), null);
  assert.equal(ownedMapRepresentation({
    viewMode: "nearby", nearbyCenterMusicId: 10, constellationSource: null,
  }, oldNearby), "nearby");
  assert.equal(ownedMapRepresentation({
    viewMode: "constellation", nearbyCenterMusicId: null, constellationSource: newJourney,
  }, { kind: "journey", targetKey: "20-30" }), "constellation");
});

test("visible nearby context wins over a stale previous queue", () => {
  player.getState().playQueue({ kind: "journey", startMusicId: 1, endMusicId: 3 }, [1, 2, 3]);
  map.getState().enterNearby(10);
  const origin = visiblePlayContext(map.getState(), 12);
  assert.deepEqual(origin, { kind: "nearby", centerMusicId: 10 });
  player.getState().playSingle(12, origin);
  assert.deepEqual(player.getState().context, origin);
  assert.deepEqual(player.getState().queue, []);
});

test("visible journey star restores its queue after another activity", () => {
  const journey = { kind: "journey", startMusicId: 20, endMusicId: 23 };
  player.getState().playQueue({ kind: "nearby", centerMusicId: 10 }, [11, 12]);
  map.getState().showConstellation([20, 21, 22, 23], [], journey);
  const origin = visiblePlayContext(map.getState(), 21);
  assert.deepEqual(origin, journey);
  player.getState().playSingle(21, origin);
  assert.deepEqual(player.getState().context, journey);
  assert.deepEqual(player.getState().queue, [20, 21, 22, 23]);
  assert.equal(player.getState().queueIndex, 1);
  player.getState().next();
  assert.equal(player.getState().currentMusicId, 22);
});

/* "재생 중" 보고를 받았을 때의 갈래 (S15P21A405-372) */
const { playingAction } = require("../src/lib/playback-events.ts");

test("an open question silences the report, not the sound", () => {
  // 예전 코드는 이 둘을 한 조건으로 묶어 카드가 뜨는 순간 소리를 끊었다
  assert.equal(playingAction(true, true), "silent", "묻는 동안에는 세지만 않는다 — 멈추지 않는다");
  assert.equal(playingAction(false, true), "stop", "우리가 멈춘 상태면 소리도 멈춘다");
  assert.equal(playingAction(false, false), "stop");
  assert.equal(playingAction(true, false), "count");
});
