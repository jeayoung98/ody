/* eslint-disable @typescript-eslint/no-require-imports */
const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { QueryClient } = require("@tanstack/react-query");
const { QUERY_KEYS } = require("../src/constants/query-keys.ts");
const { usePlayerStore: player } = require("../src/stores/use-player-store.ts");
const { useSurveyStore: survey } = require("../src/stores/use-survey-store.ts");
const { useMapStore: map } = require("../src/stores/use-map-store.ts");
const { useBlockingStore: blocking, runPlaybackTransition } = require("../src/stores/use-blocking-store.ts");
const { reportPlayback } = require("../src/lib/playback-events.ts");
const { connectSurveyPlayback } = require("../src/hooks/survey/playback-connection.ts");
const { hearSong } = require("../src/hooks/survey/listening-flow.ts");
const { questionKey } = require("../src/types/survey.ts");

const song = (musicId) => ({ musicId, title: `Song ${musicId}`, artist: "Artist", genreId: null });
const journey = (ids) => ({ key: `journey:${ids}`, mode: "journey", stops: ids.map(song) });
const flush = () => new Promise((resolve) => setImmediate(resolve));
const p = () => player.getState();
const s = () => survey.getState();
let client, disconnect;

beforeEach(() => {
  for (const store of [blocking, player, map, survey]) store.setState(store.getInitialState(), true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  cacheNearby(1, [2, 3, 4]); cacheNearby(4, [1, 5, 6, 7]);
  cacheJourney([1, 2, 3, 4]); cacheJourney([4, 5, 6, 7]); cacheJourney([7, 6, 5, 4]);
  disconnect = connectSurveyPlayback(client);
});
afterEach(() => { disconnect(); client.clear(); });

function cacheNearby(center, ids) {
  client.setQueryData(QUERY_KEYS.map.nearby(center), { center: song(center), neighbors: ids.map(song) });
}
function cacheJourney(ids) {
  client.setQueryData(QUERY_KEYS.journey.route(ids[0], ids.at(-1)), {
    stops: ids.map((id) => ({ id, title: `Song ${id}`, artist: "Artist", genreName: null, duration: 180 })),
  });
}
function event(state = "playing", override = {}) {
  reportPlayback({ musicId: p().currentMusicId, playSeq: p().playSeq, at: Date.now(), state, ...override });
}
async function audible() { event(); await flush(); }
async function play(id, origin) { p().playSingle(id, origin); await audible(); }
async function route(ids = [1, 2, 3, 4], index = 0) {
  p().playQueue({ kind: "journey", startMusicId: ids[0], endMusicId: ids.at(-1) }, ids, index);
  await audible();
}
function rowForPrompt() {
  return { ...s().prompt.target, anonymousId: "00000000-0000-4000-8000-000000000001", verdict: false, reason: "mood", listenedSec: 2, skipped: false };
}
function answer() {
  const row = rowForPrompt();
  assert.equal(s().beginSubmission(row), true);
  s().finishSubmission(row, true);
  return row;
}
async function pendingNearby() {
  await play(1); map.getState().enterNearby(1);
  await play(2, { kind: "nearby", centerMusicId: 1 });
  assert.equal(s().pending.target.musicId, 2);
}
async function pendingJourney() {
  await route(); p().next(); await audible();
  assert.equal(s().pending.target.prevMusicId, 1);
}

test("intent/video lookup is not audible playback; stale events do not count", async () => {
  p().playQueue({ kind: "journey", startMusicId: 1, endMusicId: 4 }, [1, 2, 3, 4]);
  await flush();
  assert.equal(s().lastAudible, null);
  const old = { musicId: 1, playSeq: p().playSeq };
  p().next(); event("playing", old); await flush();
  assert.equal(s().lastAudible, null);
  await audible();
  assert.equal(s().lastAudible, 2);
  assert.equal(s().pending, null);
});

test("journey asks A→B before C; success resumes C exactly once and playing", async () => {
  await pendingJourney();
  const seq = p().playSeq;
  p().next();
  // 답하는 동안에도 소리는 이어진다 — 못 들은 곡을 평가하게 두지 않는다 (S15P21A405-371)
  assert.equal(p().currentMusicId, 2); assert.equal(p().isPlaying, true);
  assert.equal(s().prompt.target.prevMusicId, 1);
  const row = answer();
  assert.equal(p().currentMusicId, 3); assert.equal(p().isPlaying, true);
  assert.equal(p().playSeq, seq + 1);
  s().finishSubmission(row, true); assert.equal(p().playSeq, seq + 1);
  await audible(); assert.equal(s().pending.target.prevMusicId, 2);
});

for (const trigger of ["bottom-next", "map-pick", "list-play"]) {
  test(`journey ${trigger} crosses the same survey gate`, async () => {
    await pendingJourney();
    if (trigger === "bottom-next") p().next();
    else if (trigger === "map-pick") p().playSingle(3);
    else p().playQueue({ kind: "journey", startMusicId: 1, endMusicId: 4 }, [1, 2, 3, 4], 2);
    assert.equal(p().currentMusicId, 2);
    assert.equal(s().prompt.target.prevMusicId, 1);
    assert.equal(s().prompt.target.musicId, 2);
    answer();
    assert.equal(p().currentMusicId, 3);
    await audible();
    assert.equal(s().pending.target.prevMusicId, 2);
    assert.equal(s().pending.target.musicId, 3);
  });
}

for (const action of ["prev", "stop"]) {
  test(`${action} also asks the existing question before changing playback`, async () => {
    await pendingJourney(); p()[action]();
    assert.equal(p().currentMusicId, 2); assert.ok(s().prompt);
    answer(); assert.equal(p().currentMusicId, action === "prev" ? 1 : null);
  });
}

test("last track end asks, then leaves the player paused", async () => {
  await route([1, 2, 3, 4], 2); p().next(); await audible();
  event("paused"); p().next(); assert.ok(s().prompt); answer();
  assert.equal(p().currentMusicId, 4); assert.equal(p().isPlaying, false);
});

test("late automatic next cannot replace an explicit destination", async () => {
  await pendingJourney(); p().playSingle(99); p().next(); p().next();
  answer(); assert.equal(p().currentMusicId, 99);
});

test("selection, closing a panel and changing views preserve a question snapshot", async () => {
  await pendingNearby(); const pending = s().pending;
  map.getState().enterNearby(4); map.getState().selectMusic(7); map.getState().exitNearby();
  await flush(); assert.equal(s().pending, pending); assert.equal(s().prompt, null);
  p().playSingle(5, { kind: "nearby", centerMusicId: 4 });
  assert.equal(s().prompt, pending); answer(); await audible();
  // 기준곡을 안 들었어도 묻는다 (S15P21A405-373, 335 결정 1 수정)
  assert.equal(s().pending.target.anchorMusicId, 4);
});

test("hearing a neighbor asks even when the anchor was never heard", async () => {
  // 335 결정 1 은 "비교할 소리가 없다" 며 버렸지만, 이제 카드 안에서 기준곡을 들을 수 있다
  await play(5, { kind: "nearby", centerMusicId: 4 });
  assert.equal(s().pending.target.anchorMusicId, 4);
  assert.equal(s().pending.target.musicId, 5);
});

test("a just-heard D seeds D nearby without replaying D", async () => {
  await play(4); map.getState().enterNearby(4);
  await play(5, { kind: "nearby", centerMusicId: 4 });
  assert.equal(s().pending.target.anchorMusicId, 4);
});

test("view-only detour does not expire A's listening eligibility", async () => {
  await pendingNearby(); map.getState().enterNearby(4); map.getState().enterNearby(1);
  p().playSingle(3, { kind: "nearby", centerMusicId: 1 }); answer(); await audible();
  assert.equal(s().pending.target.anchorMusicId, 1);
});

for (const from of ["nearby", "journey"]) for (const to of ["nearby", "journey"]) {
  test(`${from} → ${to}: preserve old question and commit activity atomically`, async () => {
    if (from === "nearby") await pendingNearby(); else await pendingJourney();
    let effects = 0;
    runPlaybackTransition(() => {
      p().stop(); map.getState().clearConstellation();
      p().playQueue(to === "nearby" ? { kind: "nearby", centerMusicId: 4 } : { kind: "journey", startMusicId: 4, endMusicId: 7 }, [4, 5, 6, 7]);
      effects++;
    });
    assert.equal(effects, 0); assert.equal(p().currentMusicId, 2);
    assert.equal(s().prompt.target.mode, from);
    answer(); assert.equal(effects, 1); assert.equal(p().currentMusicId, 4);
    await audible(); p().next(); await audible();
    assert.equal(s().pending.target.mode, to);
    assert.equal(s().pending.target.anchorMusicId, 4);
  });
}

for (const gap of [[2], [2, 3]]) {
  test(`confirmed unavailable ${gap} bridge from A to the next audible stop`, async () => {
    await route();
    for (const id of gap) {
      p().next(); assert.equal(p().currentMusicId, id); event("unavailable");
    }
    p().next(); await audible();
    assert.equal(s().pending.target.prevMusicId, 1);
    assert.equal(s().pending.target.musicId, gap.at(-1) + 1);
    p().next();
    assert.equal(s().prompt.target.prevMusicId, 1);
    assert.equal(p().currentMusicId, gap.at(-1) + 1);
    answer();
  });
}

test("journey B→C is preserved before playing F in a selected-only D nearby view", async () => {
  await pendingJourney();
  p().next(); answer(); await audible(); // C audible; B→C is now owed.
  const owed = s().pending;
  map.getState().enterNearby(4); // D selected/viewed, never heard.
  p().playSingle(5, { kind: "nearby", centerMusicId: 4 });
  assert.equal(s().prompt, owed);
  assert.equal(p().currentMusicId, 3);
  answer(); await audible();
  // D 를 듣지 않았어도 D→E 를 묻는다 (S15P21A405-373)
  assert.equal(s().pending.target.anchorMusicId, 4);
  // 이제 D→E 가 먼저 밀려 있으므로 D 로 가려면 그것부터 답해야 한다
  p().playSingle(4, { kind: "nearby", centerMusicId: 4 }); answer(); await audible();
  await play(6, { kind: "nearby", centerMusicId: 4 });
  assert.equal(s().pending.target.anchorMusicId, 4);
  assert.equal(s().pending.target.musicId, 6);
});

test("an unexpected later PLAYING report cannot replace the oldest unanswered question", async () => {
  await pendingJourney();
  const owed = s().pending;
  s().hear(5, { key: "nearby:4:1,5,6,7", mode: "nearby", center: song(4), neighbors: [1, 5, 6, 7].map(song) });
  assert.equal(s().pending, owed);
});

test("unknown lookup/failed playback does not justify skipping a route stop", async () => {
  await route(); p().next(); event("paused"); p().next(); await audible();
  assert.equal(s().pending, null);
});

test("user jumps and reverse playback excluded, subsequent forward adjacent pair valid", async () => {
  await route(); await play(4); assert.equal(s().pending, null);
  await play(3); assert.equal(s().pending, null);
  await play(4); assert.equal(s().pending.target.prevMusicId, 3);
});

test("nearby unavailable center invalidates all, unavailable neighbor only itself", async () => {
  p().playSingle(1, { kind: "nearby", centerMusicId: 1 }); event("unavailable");
  await play(2, { kind: "nearby", centerMusicId: 1 }); assert.equal(s().pending, null);
  await play(1, { kind: "nearby", centerMusicId: 1 });
  assert.equal(s().unplayable.has(1), false, "actual recovery clears negative evidence");
  p().playSingle(2, { kind: "nearby", centerMusicId: 1 }); event("unavailable");
  await play(3, { kind: "nearby", centerMusicId: 1 }); assert.equal(s().pending.target.musicId, 3);
});

test("same song resume neither asks nor consumes the pending pair", async () => {
  await pendingJourney(); const pending = s().pending, seq = p().playSeq;
  p().pause(); p().playSingle(2); await audible();
  assert.equal(s().pending, pending); assert.equal(s().prompt, null); assert.equal(p().playSeq, seq);
});

test("failed save preserves exact answer, blocks C, suppresses null and retries same row", async () => {
  await pendingJourney(); p().next(); const row = rowForPrompt();
  assert.equal(s().beginSubmission(row), true);
  assert.equal(s().beginSubmission(row), false, "double-click cannot send twice");
  assert.equal(s().takeUnanswered(), null);
  s().finishSubmission(row, false);
  assert.equal(s().submission, row); assert.equal(s().saveError, true);
  assert.equal(s().hasAnswered(row), false); assert.equal(p().currentMusicId, 2);
  assert.equal(s().takeUnanswered(), null);
  assert.equal(s().beginSubmission(row), true); s().finishSubmission(row, true);
  assert.equal(s().hasAnswered(row), true); assert.equal(p().currentMusicId, 3);
});

test("explicit continue after failure neither marks answered nor creates unanswered", async () => {
  await pendingNearby(); p().playSingle(3); const row = rowForPrompt();
  s().beginSubmission(row); s().finishSubmission(row, false); s().close();
  assert.equal(p().currentMusicId, 3); assert.equal(s().hasAnswered(row), false);
  assert.equal(s().takeUnanswered(), null);
  s().finishSubmission(row, true); assert.equal(s().hasAnswered(row), false, "late callback cannot affect the next prompt");
});

test("answered history and session answers prevent repeated questions", async () => {
  await pendingNearby(); const key = questionKey(s().pending.target);
  s().loadAnswered([key]); p().playSingle(3); assert.equal(s().prompt, null); await audible();
  p().playSingle(2); answer(); await audible(); assert.equal(s().pending, null);
});

test("late history closes an answered prompt without waiting for a second answer", async () => {
  await pendingJourney(); p().next(); s().loadAnswered([questionKey(s().prompt.target)]);
  assert.equal(s().prompt, null); assert.equal(p().currentMusicId, 3);
});

test("history still loading defers the decision, never flashes a duplicate question", async () => {
  await pendingJourney(); const key = questionKey(s().pending.target);
  s().setHistoryLoading(true); p().next();
  assert.equal(s().prompt, null); assert.equal(p().currentMusicId, 2);
  s().loadAnswered([key]); assert.equal(p().currentMusicId, 3); assert.equal(s().prompt, null);
});

test("history failure stops waiting and keeps a legitimate current question", async () => {
  await pendingNearby(); s().setHistoryLoading(true); p().playSingle(3);
  s().setHistoryLoading(false); assert.equal(s().prompt.target.musicId, 2);
  answer(); assert.equal(p().currentMusicId, 3);
});

test("pagehide only sends a valid unanswered pair once; bfcache answer uses a new row", async () => {
  assert.equal(s().takeUnanswered(), null); await pendingNearby(); p().playSingle(3);
  const old = s().takeUnanswered(); assert.ok(old);
  assert.equal(s().takeUnanswered(), null); s().resumeAfterPagehide();
  assert.notEqual(s().prompt.target.sessionId, old.target.sessionId);
  assert.equal(questionKey(s().prompt.target), questionKey(old.target));
  answer(); assert.equal(p().currentMusicId, 3);
});

test("clock advances only for confirmed audible intervals, not requested playback", () => {
  p().playSingle(1); assert.equal(s().visit, null);
  s().enter(1, true, 1000); s().enter(1, false, 4000); s().enter(1, true, 9000); s().enter(null, false, 10000);
  assert.equal(s().stintMs(1), 4000);
});

test("slow recommendation resolution holds transition instead of losing its question", async () => {
  await play(1);
  let finish;
  const original = client.ensureQueryData.bind(client);
  client.ensureQueryData = (options) => options.queryKey[0] === "map" ? new Promise((r) => { finish = r; }) : original(options);
  p().playSingle(2, { kind: "nearby", centerMusicId: 1 }); event(); p().playSingle(3);
  assert.equal(p().currentMusicId, 2); assert.equal(blocking.getState().busy, true);
  finish({ center: song(1), neighbors: [2, 3, 4].map(song) }); await flush();
  assert.equal(s().prompt.target.musicId, 2); answer(); assert.equal(p().currentMusicId, 3);
});

test("late recommendation response uses captured source, not selected view", async () => {
  await play(1); p().playSingle(2, { kind: "nearby", centerMusicId: 1 });
  map.getState().enterNearby(4); await audible();
  assert.equal(s().pending.target.anchorMusicId, 1);
});

test("removing the adapter releases playback and no tutorial listening is recorded", async () => {
  disconnect();
  await route(); p().next(); await audible(); p().prev(); p().stop();
  assert.equal(s().lastAudible, null); assert.equal(blocking.getState().gate, null);
  disconnect = connectSurveyPlayback(client);
  await route(); p().next(); await audible(); assert.ok(s().pending);
});

test("changing predecessor at the same rank cannot overwrite a different backend row", () => {
  const source = journey([1, 2, 3]); let count = 0;
  const uid = () => `session-${++count}`;
  const first = hearSong(source, 1, null, null, new Set([2]), uid);
  const skipped = hearSong(source, 3, first.flow, 1, new Set([2]), uid);
  const backwards = hearSong(source, 2, skipped.flow, 3, new Set(), uid);
  const adjacent = hearSong(source, 3, backwards.flow, 2, new Set(), uid);
  assert.equal(skipped.edge.target.rank, adjacent.edge.target.rank);
  assert.notEqual(skipped.edge.target.prevMusicId, adjacent.edge.target.prevMusicId);
  assert.notEqual(skipped.edge.target.sessionId, adjacent.edge.target.sessionId);
});

/* 설문 카드가 떠 있는 동안의 재생 (S15P21A405-371) */

test("an open question keeps the sound going but stops the listening clock", async () => {
  await pendingJourney();
  p().next();
  assert.ok(s().prompt, "질문이 떠 있어야 한다");
  assert.equal(p().isPlaying, true, "답하는 동안에도 소리는 이어져야 한다");
  const target = s().prompt.target.musicId;
  const listened = s().stintMs(target);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(s().stintMs(target), listened, "시계는 멈춰 있어야 한다");
});

test("replaying a song from the card does not move the queue", async () => {
  await pendingJourney();
  p().next();
  const { queue, queueIndex, context } = p();
  const compare = s().prompt.compare.musicId;
  p().preview(compare);
  assert.equal(p().currentMusicId, compare, "누른 곡이 울려야 한다");
  assert.equal(p().isPlaying, true);
  assert.deepEqual(p().queue, queue, "큐는 그대로여야 한다");
  assert.equal(p().queueIndex, queueIndex);
  assert.deepEqual(p().context, context);
  assert.ok(s().prompt, "다시 듣는다고 질문이 닫히면 안 된다");
});
