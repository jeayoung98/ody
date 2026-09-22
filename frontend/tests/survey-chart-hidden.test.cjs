/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **설문 모드에서는 랭킹만 감춘다** (S15P21A405-570).
 *
 * 예전(S15P21A405-333)에는 네 기능을 통째로 감췄고 그 축을 S15P21A405-480 이 걷어냈다.
 * 이번에 되살린 것은 랭킹 하나뿐이라, 나머지가 딸려 꺼지지 않는 것이 이 파일이 지키는 선이다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FEATURES, PANEL_ENABLED, SURVEY_FEATURES, SURVEY_PANEL_ENABLED } = require("../src/constants/features.ts");

test("설문 모드에서 랭킹이 꺼진다", () => {
  assert.equal(SURVEY_FEATURES.chart, false);
  assert.equal(SURVEY_PANEL_ENABLED.chart, false);
});

test("랭킹 말고는 평소와 같다 — 딸려 꺼지는 기능이 없다", () => {
  for (const k of Object.keys(FEATURES)) {
    if (k === "chart") continue;
    assert.equal(SURVEY_FEATURES[k], FEATURES[k], `${k} 가 설문 모드에서 달라졌다`);
  }
  for (const k of Object.keys(PANEL_ENABLED)) {
    if (k === "chart") continue;
    assert.equal(SURVEY_PANEL_ENABLED[k], PANEL_ENABLED[k], `${k} 패널이 설문 모드에서 달라졌다`);
  }
});

/**
 * 훅이 매 렌더 새 객체를 돌려주면 `useSurveyMode` 의 `useSyncExternalStore` 가 스냅샷이
 * 계속 바뀐 것으로 보고 무한 렌더에 빠진다. 두 표 모두 모듈 수준에서 한 번만 만들어야 한다.
 */
test("두 표는 고정 객체다 — 읽을 때마다 같은 것이 나온다", () => {
  const again = require("../src/constants/features.ts");
  assert.equal(again.PANEL_ENABLED, PANEL_ENABLED);
  assert.equal(again.SURVEY_PANEL_ENABLED, SURVEY_PANEL_ENABLED);
  assert.notEqual(SURVEY_PANEL_ENABLED, PANEL_ENABLED);
});
