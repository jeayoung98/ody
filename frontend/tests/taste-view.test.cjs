/* eslint-disable @typescript-eslint/no-require-imports */
// 취향 분석 응답 하나를 화면이 무엇으로 읽는가 (S15P21A405-630).
//
// 백엔드는 state(6가지) · reportEligibility · generation 셋으로 상황을 말한다. 조합이 많아서
// 컴포넌트 안에서 분기하면 어느 상태가 빠졌는지 알 수 없다 — 버튼이 잠겨야 할 때 열려 있으면
// 429·422 를 눌러 보고서야 알게 되고, 안내가 겹치면 그중 하나는 거짓말이 된다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tasteView, TASTE_NOTICE } = require("../src/lib/taste-view.ts");

const report = (over = {}) => ({
  level: "STANDARD",
  aiGenerated: true,
  fresh: true,
  summary: "촘촘한 박자를 좋아하시네요",
  narratives: [{ findingId: "pc3-high", text: "박자가 촘촘한 곡이 많아요", evidence: "median 0.81" }],
  analyzedAt: "2026-09-23T10:00:00+09:00",
  generatedAt: "2026-09-23T10:00:05+09:00",
  lastRefreshedAt: "2026-09-23T10:00:05+09:00",
  ...over,
});

const analysis = (over = {}) => ({
  state: "READY",
  counts: { totalLiked: 30, valid: 30, excluded: 0, exclusions: {} },
  reportEligibility: { eligible: true, level: "STANDARD", additionalLikesNeeded: 0 },
  analysisVersion: "v1",
  axes: [],
  points: [],
  report: null,
  generation: {
    status: "NOT_REQUESTED",
    generatedThisRequest: false,
    dailyLimitUsedToday: false,
    canRetry: false,
    failureCode: null,
    nextAvailableAt: null,
  },
  ...over,
});

test("좋아요가 하나도 없으면 무엇부터 해야 하는지 말한다", () => {
  const view = tasteView(analysis({
    state: "EMPTY",
    counts: { totalLiked: 0, valid: 0, excluded: 0, exclusions: {} },
    reportEligibility: { eligible: false, level: null, additionalLikesNeeded: 10 },
  }));
  assert.equal(view.notice, TASTE_NOTICE.empty);
  assert.equal(view.canGenerate, false);
});

test("곡이 모자라면 몇 곡이 더 필요한지 적는다", () => {
  const view = tasteView(analysis({
    state: "DISTRIBUTION_ONLY",
    counts: { totalLiked: 7, valid: 7, excluded: 0, exclusions: {} },
    reportEligibility: { eligible: false, level: null, additionalLikesNeeded: 3 },
  }));
  assert.equal(view.notice, "3곡 더 좋아요하면 취향 리포트를 만들 수 있어요.");
  assert.equal(view.canGenerate, false);
});

test("만들 수 있으면 버튼만 열고 잔소리는 하지 않는다", () => {
  const view = tasteView(analysis());
  assert.equal(view.canGenerate, true);
  assert.equal(view.buttonLabel, "리포트 만들기");
  assert.equal(view.notice, null);
});

test("리포트가 있으면 다시 만들기다", () => {
  const view = tasteView(analysis({ state: "FRESH", report: report() }));
  assert.equal(view.buttonLabel, "다시 만들기");
  assert.equal(view.stale, false);
  assert.equal(view.notice, null);
});

/** 리포트는 그대로 두고 "바뀌었다"만 알린다 — 지우면 다시 만들기 전까지 볼 게 없어진다 */
test("좋아요가 바뀌면 리포트는 남기고 다시 만들기를 권한다", () => {
  const view = tasteView(analysis({ state: "STALE", report: report({ fresh: false }) }));
  assert.equal(view.stale, true);
  assert.ok(view.report);
  assert.equal(view.canGenerate, true);
  assert.equal(view.notice, TASTE_NOTICE.stale);
});

/**
 * **이 파일의 핵심이다.** 생성 중에 버튼이 열려 있으면 두 번 눌리고, 백엔드는 409
 * `TASTE_ANALYSIS_IN_PROGRESS` 로 막는다 — 사용자에게는 눌러도 아무 일이 없는 버튼이 된다.
 */
test("생성 중에는 자격이 있어도 버튼을 잠근다", () => {
  const view = tasteView(analysis({ state: "IN_PROGRESS", generation: { ...analysis().generation, status: "IN_PROGRESS" } }));
  assert.equal(view.generating, true);
  assert.equal(view.canGenerate, false);
  assert.equal(view.notice, TASTE_NOTICE.generating);
});

/** 하루 한 번이다. 열어 두면 429 를 눌러 보고서야 알게 된다 */
test("오늘 몫을 썼으면 잠그고 내일이라고 말한다", () => {
  const view = tasteView(analysis({
    state: "FRESH",
    report: report(),
    generation: { ...analysis().generation, dailyLimitUsedToday: true },
  }));
  assert.equal(view.canGenerate, false);
  assert.equal(view.notice, TASTE_NOTICE.dailyLimit);
});

/** 생성 중인데 좋아요도 바뀐 상태 — 지금 벌어지는 일이 먼저다 */
test("안내는 하나만 뜬다 — 지금 벌어지는 일이 우선이다", () => {
  const view = tasteView(analysis({
    state: "IN_PROGRESS",
    report: report({ fresh: false }),
    generation: { ...analysis().generation, status: "IN_PROGRESS", dailyLimitUsedToday: true },
  }));
  assert.equal(view.notice, TASTE_NOTICE.generating);
});

/** FALLBACK 은 실패가 아니라 덜 다듬어진 것이다. 오류로 말하면 안 된다 */
test("규칙으로 채운 문장은 실패가 아니라고 말한다", () => {
  const view = tasteView(analysis({ state: "FRESH", report: report({ aiGenerated: false }) }));
  assert.equal(view.notice, TASTE_NOTICE.fallback);
  assert.ok(view.report);
});
