/* eslint-disable @typescript-eslint/no-require-imports */
// 취향 분석 응답 하나를 화면이 무엇으로 읽는가 (S15P21A405-630).
//
// 백엔드는 state(6가지) · reportEligibility · generation 셋으로 상황을 말한다. 조합이 많아서
// 컴포넌트 안에서 분기하면 어느 상태가 빠졌는지 알 수 없다 — 버튼이 잠겨야 할 때 열려 있으면
// 429·422 를 눌러 보고서야 알게 되고, 안내가 겹치면 그중 하나는 거짓말이 된다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { tasteView, tasteTags, tasteBadge, TASTE_NOTICE } = require("../src/lib/taste-view.ts");

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

// ---------- 태그·배지 (S15P21A405-639) — 백엔드 634 가 findings 와 label.axis 를 내려 주게 된 뒤 ----------

const axis = (pc, label) => ({
  pc,
  raw: { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
  percentile: { min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0 },
  histogram: [],
  explainedVariance: 0,
  label: { status: "VERIFIED", strength: "STRONG", axis: "밝기", low: "어두운", high: "밝은", evidence: "", ...label },
});
const finding = (over = {}) => ({
  id: "pc1-bias", type: "BIAS", pc: 1, direction: "LOW", effectSize: 0.3, evidence: "median 31", axisPhrase: "어두운", ...over,
});

test("기운 축은 그 극의 말에 ' 곡' 을 붙인 태그다 — 방향은 문장을 쪼개지 않고 direction 으로 읽는다", () => {
  const [low] = tasteTags([finding()], [axis(1)]);
  assert.equal(low.text, "#어두운 곡");
  assert.equal(low.strength, "mild", "BIAS 는 옅게");
  const [high] = tasteTags([finding({ id: "pc1-consistent_bias", type: "CONSISTENT_BIAS", direction: "HIGH", axisPhrase: "밝은" })], [axis(1)]);
  assert.equal(high.text, "#밝은 곡");
  assert.equal(high.strength, "strong", "CONSISTENT_BIAS 는 진하게");
});

test("백엔드가 태그 어형(lowTag/highTag)을 주면 그대로 쓴다", () => {
  const [t] = tasteTags([finding()], [axis(1, { lowTag: "어둑한 노래" })]);
  assert.equal(t.text, "#어둑한 노래");
});

test("폭넓은 축은 축 이름으로 '#밝기 폭넓음' — 이게 label.axis 를 받은 이유다", () => {
  const [t] = tasteTags([finding({ id: "pc1-diverse", type: "DIVERSE", direction: "BOTH", axisPhrase: "어두운 / 밝은" })], [axis(1)]);
  assert.equal(t.text, "#밝기 폭넓음");
  assert.equal(t.strength, "strong");
});

test("축 이름이 없으면(낡은 기준 산출물) 양 끝을 이어 태그를 만든다", () => {
  const [t] = tasteTags([finding({ id: "pc1-diverse", type: "DIVERSE", direction: "BOTH", axisPhrase: "어두운 / 밝은" })], [axis(1, { axis: null })]);
  assert.equal(t.text, "#어두운 · 밝은 폭넓음");
});

test("어느 축도 튀지 않으면 '#고른 취향' 하나다", () => {
  const [t] = tasteTags([{ id: "balanced", type: "BALANCED", pc: null, direction: "CENTER", effectSize: 0, evidence: "", axisPhrase: "" }], []);
  assert.equal(t.text, "#고른 취향");
});

/** 634 전에 만든 리포트에는 findings 가 없다. 화면은 태그 줄을 안 그려야 하고, 터지면 안 된다 */
test("findings 가 없는 구 응답이면 태그가 비고 나머지는 그대로다", () => {
  const view = tasteView(analysis({ state: "FRESH", report: report() }));
  assert.deepEqual(view.tags, []);
  assert.equal(view.badge, null, "STANDARD 는 배지가 없다");
});

test("INITIAL 리포트는 요약은 그대로 두고 잠정 배지를 붙인다", () => {
  const view = tasteView(analysis({ state: "FRESH", report: report({ level: "INITIAL", findings: [finding()] }), axes: [axis(1)] }));
  assert.equal(view.report.summary, "촘촘한 박자를 좋아하시네요", "문장에 접두사가 섞이지 않는다");
  assert.equal(view.badge.text, "잠정");
  assert.equal(view.tags.length, 1);
  assert.equal(tasteBadge("STANDARD"), null);
});
