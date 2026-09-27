/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **폰에서 주변 탐색·별자리는 시트를 올려도 그대로다** (S15P21A405-715, 사용자 결정).
 *
 * 두 뷰가 가림폭을 따라가서 2 단으로 올리면 고리·별자리가 줄었고, 가림폭이 여러 프레임에 걸쳐 따라가는 동안
 * 배치를 매 프레임 다시 해 화면이 떨렸다. 뷰가 뜰 때의 남은 화면을 붙잡는다 — 틀리면 시트를 올릴 때마다 다시 줄고 떨린다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { PROBE, CONSTELLATION } = require("../src/constants/map.ts");

/** 360 × 780 폰. 위 153px(브랜드·뷰 칩), 아래 253px(1 단 시트·플레이어·내비) */
const ONE = { top: 153, right: 0, bottom: 253, left: 0 };
/** 2 단: 시트가 136px 더 올라왔다 */
const TWO = { ...ONE, bottom: 253 + 136 };

function phone(W = 360, H = 780) {
  const e = new MapEngine();
  e.W = W;
  e.H = H;
  e.setOcclusion(ONE, "now");
  return e;
}
/** 들어오는 연출이 이미 끝난 주변 탐색 */
const settledProbe = () => ({ exitingAt: null, rings: [{ t0: performance.now() - PROBE.enterMs - 1000 }] });

test("폰: 주변 탐색 중에 시트를 2단으로 올려도 고리가 쓰는 화면은 그대로다", () => {
  const e = phone();
  e.probe = settledProbe();
  assert.equal(e.overlayRect().y1, 780 - 253);
  e.setOcclusion(TWO, "now");
  assert.equal(e.freeRect().y1, 780 - 253 - 136, "지도 자체의 남은 화면은 줄어든다");
  assert.equal(e.overlayRect().y1, 780 - 253, "고리는 뷰가 뜰 때의 화면을 쓴다");
});

test("폰: 별자리도 같다", () => {
  const e = phone();
  e.constellation = { t0: performance.now() - CONSTELLATION.enterMs - 1000, exitingAt: null };
  const before = e.overlayRect();
  e.setOcclusion(TWO, "now");
  assert.deepEqual(e.overlayRect(), before);
});

test("폰: 들어오는 동안에는 목표 가림폭을 따라간다 — 뷰를 연 손짓이 시트 단도 함께 옮긴다", () => {
  const e = phone();
  e.setOcclusion(TWO, "now");
  e.probe = { exitingAt: null, rings: [{ t0: performance.now() }] };
  assert.equal(e.overlayRect().y1, 780 - 253 - 136);
  // 들어오는 중에 시트가 1 단으로 내려앉았다 (712)
  e.setOcclusion(ONE);
  assert.equal(e.overlayRect().y1, 780 - 253);
});

test("폰: 화면 크기가 바뀌면 다시 잡는다", () => {
  const e = phone();
  e.probe = settledProbe();
  e.overlayRect();
  e.setOcclusion(TWO, "now");
  e.W = 390;
  e.H = 844;
  assert.equal(e.overlayRect().y1, 844 - 253 - 136);
});

test("폰: 뷰가 끝나면 붙잡은 것을 놓는다 — 다음 뷰는 그때의 화면으로 뜬다", () => {
  const e = phone();
  e.probe = settledProbe();
  e.overlayRect();
  e.probe = null;
  e.setOcclusion(TWO, "now");
  assert.equal(e.overlayRect().y1, e.freeRect().y1);
  e.constellation = { t0: performance.now() - CONSTELLATION.enterMs - 1000, exitingAt: null };
  assert.equal(e.overlayRect().y1, 780 - 253 - 136);
});

test("넓은 화면은 그대로 따라간다 — 우측 패널이 열리면 별자리가 좁아지는 것이 맞다", () => {
  const e = phone(1280, 800);
  e.setOcclusion({ top: 58, right: 0, bottom: 92, left: 0 }, "now");
  e.probe = settledProbe();
  e.overlayRect();
  e.setOcclusion({ right: 410 }, "now");
  assert.equal(e.overlayRect().x1, 1280 - 410);
});
