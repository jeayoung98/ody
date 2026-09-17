/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { allowsPostHog, publicAnalyticsConfig, sanitizeProperties } = require("../src/lib/analytics/policy.ts");
const { isLoopbackBackend, shouldPersistSurvey } = require("../src/lib/survey-persistence.ts");
const { analyticsDebugEnabled, analyticsEnabled, analyticsEnvironment, analyticsRuntimePolicy } = require("../src/lib/analytics/mode.ts");
const { enqueueGtag } = require("../src/lib/analytics/transport.ts");
const { EngagementClock } = require("../src/lib/analytics/engagement.ts");
const { PlaybackMeter } = require("../src/lib/analytics/playback.ts");
const feedbackRoute = require("../src/app/bff/feedback/route.ts");
const answeredRoute = require("../src/app/bff/feedback/answered/route.ts");

test("PostHog mode can shrink future collection without changing GA events", () => {
  assert.equal(allowsPostHog("music_clicked", "all"), true);
  assert.equal(allowsPostHog("music_clicked", "core"), false);
  assert.equal(allowsPostHog("play_started", "core"), true);
  assert.equal(allowsPostHog("play_started", "off"), false);
});

test("runtime config rejects malformed public keys and defaults safely", () => {
  const off = publicAnalyticsConfig({ GA_MEASUREMENT_ID: "bad", POSTHOG_PROJECT_KEY: "secret" });
  assert.equal(off.gaId, "");
  assert.equal(off.posthogKey, "");
  const live = publicAnalyticsConfig({ GA_MEASUREMENT_ID: "G-ABC123", POSTHOG_PROJECT_KEY: "phc_abc123", POSTHOG_REGION: "eu", POSTHOG_MODE: "core" });
  assert.equal(live.dataSource, "live");
  assert.equal(live.posthogHost, "https://eu.i.posthog.com");
  assert.equal(live.posthogMode, "core");
  const mock = publicAnalyticsConfig({ USE_MOCK_API: "1" });
  assert.equal(mock.dataSource, "mock");
});

test("analytics separates real dev and production traffic by environment", () => {
  assert.equal(analyticsEnvironment("localhost"), "development");
  assert.equal(analyticsEnvironment("127.0.0.1"), "development");
  assert.equal(analyticsEnvironment("[::1]"), "development");
  assert.equal(analyticsEnvironment("j15a405.p.ssafy.io"), "production");
});

test("analytics runtime matrix is automatic and browser off wins everywhere", () => {
  const cases = [
    ["localhost", "live", true, "development", true, true],
    ["localhost", "mock", true, "development", true, false],
    ["localhost", "live", false, "development", false, false],
    ["localhost", "mock", false, "development", false, false],
    ["j15a405.p.ssafy.io", "live", true, "production", false, true],
    ["j15a405.p.ssafy.io", "mock", true, "production", false, false],
    ["j15a405.p.ssafy.io", "live", false, "production", false, false],
    ["j15a405.p.ssafy.io", "mock", false, "production", false, false],
  ];

  for (const [hostname, dataSource, enabled, environment, logLocal, sendExternal] of cases) {
    assert.deepEqual(analyticsRuntimePolicy(hostname, dataSource, enabled), {
      environment, logLocal, sendExternal,
    });
  }
});

test("analytics browser switch defaults on and understands the shared true/false convention", () => {
  const values = new Map();
  const previousWindow = global.window;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  global.window = { localStorage: storage, sessionStorage: storage };
  assert.equal(analyticsEnabled(), true);
  assert.equal(analyticsDebugEnabled(), false);
  values.set("ody:analytics-mode", "false");
  assert.equal(analyticsEnabled(), false);
  values.set("ody:analytics-mode", "true");
  assert.equal(analyticsEnabled(), true);
  values.delete("ody:analytics-mode");
  assert.equal(analyticsEnabled(), true);
  values.set("ody:analytics-debug", "true");
  assert.equal(analyticsDebugEnabled(), true);
  values.set("ody:analytics-debug", "false");
  assert.equal(analyticsDebugEnabled(), false);
  global.window = previousWindow;
});

test("gtag queues the Arguments object required by the official Google tag snippet", () => {
  const previousWindow = global.window;
  global.window = { dataLayer: [] };

  enqueueGtag("config", "G-TEST", { debug_mode: true });

  const [command] = global.window.dataLayer;
  assert.equal(Object.prototype.toString.call(command), "[object Arguments]");
  assert.deepEqual(Array.from(command), ["config", "G-TEST", { debug_mode: true }]);
  global.window = previousWindow;
});

test("survey persistence matrix isolates test writes to an explicit local database", () => {
  const cases = [
    { name: "local-default", context: { backendEnabled: true, hostname: "localhost", localTestDatabase: false }, expected: false },
    { name: "local-db", context: { backendEnabled: true, hostname: "localhost", localTestDatabase: true }, expected: true },
    { name: "mock-local", context: { backendEnabled: false, hostname: "localhost", localTestDatabase: true }, expected: false },
    { name: "mock-live", context: { backendEnabled: false, hostname: "j15a405.p.ssafy.io", localTestDatabase: false }, expected: false },
    { name: "live", context: { backendEnabled: true, hostname: "j15a405.p.ssafy.io", localTestDatabase: false }, expected: true },
  ];
  for (const row of cases) assert.equal(shouldPersistSurvey(row.context), row.expected, row.name);
  assert.equal(isLoopbackBackend("http://localhost:8080"), true);
  assert.equal(isLoopbackBackend("https://j15a405.p.ssafy.io"), false);
});

test("survey BFF skips local-without-db and mock writes", async () => {
  const previousMock = process.env.USE_MOCK_API;
  const call = async (url, headers) => {
    const post = await feedbackRoute.POST(new Request(url, { method: "POST", headers, body: "{}" }));
    const get = await answeredRoute.GET(new Request(`${url}/answered?anonymousId=test`, { headers }));
    const postBody = await post.json();
    const getBody = await get.json();
    assert.equal(postBody.data.feedbackId, 0);
    assert.deepEqual(getBody.data, []);
  };
  try {
    delete process.env.USE_MOCK_API;
    await call("http://localhost/bff/feedback");
    process.env.USE_MOCK_API = "1";
    await call("https://j15a405.p.ssafy.io/bff/feedback");
  } finally {
    if (previousMock == null) delete process.env.USE_MOCK_API;
    else process.env.USE_MOCK_API = previousMock;
  }
});

test("GA properties remain scalar, bounded and free of invalid names", () => {
  const clean = sanitizeProperties({ valid_name: "x".repeat(120), "bad-name": "no", nan: Number.NaN, count: 3, ok: true, empty: null });
  assert.equal(clean.valid_name.length, 100);
  assert.deepEqual({ count: clean.count, ok: clean.ok }, { count: 3, ok: true });
  assert.equal("bad-name" in clean, false);
  assert.equal("nan" in clean, false);
});

test("engagement emits interval deltas instead of cumulative time", () => {
  const clock = new EngagementClock(0);
  assert.deepEqual(clock.take(1_000, true, false, false), { foreground_ms: 1000, explore_ms: 1000, playback_ms: 0 });
  assert.deepEqual(clock.take(1_500, true, true, true), { foreground_ms: 500, explore_ms: 0, playback_ms: 500 });
});

test("playback qualifies after 20 audible seconds and excludes pauses", () => {
  let now = 0;
  const events = [];
  const meter = new PlaybackMeter((name, properties) => events.push({ name, properties }), () => now);
  meter.begin({ music_id: 7 });
  meter.change(1);
  now = 10_000;
  meter.change(2);
  now = 15_000;
  meter.change(1);
  now = 25_000;
  meter.checkpoint();
  meter.end("stopped");
  assert.deepEqual(events.map((event) => event.name), ["play_requested", "play_started", "play_paused", "play_resumed", "play_qualified", "play_ended"]);
  assert.equal(events.at(-1).properties.listened_ms, 20_000);
});
