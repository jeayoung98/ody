/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **기능 표시는 설문 모드를 보지 않는다** (S15P21A405-612).
 *
 * 설문 모드로 랭킹을 감추자(S15P21A405-570) 콘테스트가 딸려 꺼졌다. 이제 그 모드는 설문만
 * 가르고, 기능 표는 하나뿐이다 — 설문 모드용 표가 다시 생기면 이 파일이 먼저 깨진다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const features = require("../src/constants/features.ts");

test("기능 표는 하나다 — 설문 모드용 표가 없다", () => {
  assert.deepEqual(Object.keys(features).sort(), ["FEATURES", "PANEL_ENABLED"]);
});

test("전부 켜져 있다", () => {
  for (const [k, v] of Object.entries(features.FEATURES)) assert.equal(v, true, `${k} 가 꺼져 있다`);
  for (const [k, v] of Object.entries(features.PANEL_ENABLED)) assert.equal(v, true, `${k} 패널이 꺼져 있다`);
});
