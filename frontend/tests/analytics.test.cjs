/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const { allowsPostHog, publicAnalyticsConfig, sanitizeProperties } = require("../src/lib/analytics/policy.ts");
const { EngagementClock } = require("../src/lib/analytics/engagement.ts");
const { PlaybackMeter } = require("../src/lib/analytics/playback.ts");

test("PostHog mode can shrink future collection without changing GA events", () => {
  assert.equal(allowsPostHog("music_hovered", "all"), true);
  assert.equal(allowsPostHog("music_hovered", "core"), false);
  assert.equal(allowsPostHog("play_started", "core"), true);
  assert.equal(allowsPostHog("play_started", "off"), false);
});

test("runtime config rejects malformed public keys and defaults safely", () => {
  const off = publicAnalyticsConfig({ ANALYTICS_MODE: "live", GA_MEASUREMENT_ID: "bad", POSTHOG_PROJECT_KEY: "secret" });
  assert.equal(off.gaId, "");
  assert.equal(off.posthogKey, "");
  const live = publicAnalyticsConfig({ ANALYTICS_MODE: "live", GA_MEASUREMENT_ID: "G-ABC123", POSTHOG_PROJECT_KEY: "phc_abc123", POSTHOG_REGION: "eu", POSTHOG_MODE: "core" });
  assert.equal(live.posthogHost, "https://eu.i.posthog.com");
  assert.equal(live.posthogMode, "core");
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
  assert.deepEqual(clock.take(1_000, true, false, false, false), { foreground_ms: 1000, explore_ms: 1000, playback_ms: 0, survey_ms: 0 });
  assert.deepEqual(clock.take(1_500, true, true, true, true), { foreground_ms: 500, explore_ms: 0, playback_ms: 500, survey_ms: 500 });
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
