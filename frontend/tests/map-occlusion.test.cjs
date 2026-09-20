/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 지도 가림 영역 (S15P21A405-414).
 *
 * `freeRect()` 는 "지도가 실제로 보이는 사각형" 이고, 엔진에서 **어디에 놓을지를 정하는 것들이
 * 전부 이걸 읽는다** — 카메라 한계, 주변 탐색 고리, 별자리, 파고들 배율, 화면 밖 표식, 게이트
 * 판정까지. 그래서 여기가 틀어지면 증상이 스물몇 군데로 흩어져 나온다.
 *
 * 예전에는 우측만 변수고 위아래가 상수였다. 모바일 바텀시트는 아래를 덮으므로 네 변이 다
 * 움직여야 한다. **데스크톱(우측만 씀) 결과가 그대로인 것**이 이 이슈의 조건이라 그것부터 잰다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { HUD_OCCLUSION, OCCLUSION_EASE } = require("../src/constants/map.ts");

/** 화면 크기만 준 엔진. `inited` 가 false 라 `setOcclusion` 은 늘 즉시 반영된다 */
function engine(W = 1280, H = 860) {
  const e = new MapEngine();
  e.W = W;
  e.H = H;
  return e;
}

test("기본값은 예전 하드코딩과 같다 — 위 58 · 아래 92 · 왼쪽 0", () => {
  const f = engine().freeRect();
  assert.equal(f.x0, 0);
  assert.equal(f.y0, HUD_OCCLUSION.top);
  assert.equal(f.y1, 860 - HUD_OCCLUSION.bottom);
  assert.equal(f.x1, 1280 - 76, "우측 기본값 76 도 그대로");
});

test("우측만 주면 예전 동작과 완전히 같다 — 데스크톱 회귀", () => {
  const e = engine();
  for (const right of [64, 410]) {
    e.setOcclusion({ right });
    const f = e.freeRect();
    // 예전 식: x0=0, x1=max(120, W-right), y0=58, y1=max(y0+120, H-92)
    assert.equal(f.x0, 0);
    assert.equal(f.x1, Math.max(120, 1280 - right));
    assert.equal(f.y0, 58);
    assert.equal(f.y1, Math.max(58 + 120, 860 - 92));
    assert.equal(f.cx, (f.x0 + f.x1) / 2);
    assert.equal(f.cy, (f.y0 + f.y1) / 2);
  }
});

test("아래를 덮으면 사각형이 그만큼 위로 줄어든다 — 바텀시트가 쓸 길", () => {
  const e = engine();
  e.setOcclusion({ bottom: 400 });
  const f = e.freeRect();
  assert.equal(f.y1, 860 - 400);
  assert.equal(f.y0, 58, "위는 그대로");
  assert.equal(f.x1, 1280 - 76, "우측도 그대로 — 준 변만 바뀐다");
});

test("준 변만 바뀌고 나머지는 남는다", () => {
  const e = engine();
  e.setOcclusion({ right: 410 });
  e.setOcclusion({ bottom: 300 });
  const f = e.freeRect();
  assert.equal(f.x1, 1280 - 410);
  assert.equal(f.y1, 860 - 300);
});

test("왼쪽을 덮으면 x0 이 밀리고 가운데도 따라 옮겨간다", () => {
  const e = engine();
  e.setOcclusion({ left: 200 });
  const f = e.freeRect();
  assert.equal(f.x0, 200);
  assert.equal(f.cx, (200 + (1280 - 76)) / 2);
});

/*
 * 끝까지 덮었을 때가 제일 위험하다. 사각형이 뒤집히거나 0 이 되면 그걸 읽는 스물몇 군데가
 * 전부 NaN·무한대로 번진다 — 좁아도 유효한 사각형이 나가야 한다.
 */
test("다 덮어도 최소 120px 는 남는다 — 뒤집히거나 0 이 되지 않는다", () => {
  const e = engine();
  e.setOcclusion({ top: 9999, right: 9999, bottom: 9999, left: 9999 });
  const f = e.freeRect();
  assert.equal(f.x1 - f.x0, 120);
  assert.equal(f.y1 - f.y0, 120);
  for (const v of [f.x0, f.y0, f.x1, f.y1, f.cx, f.cy]) assert.ok(Number.isFinite(v), `유한해야 한다: ${v}`);
});

/*
 * 손가락을 따라가는 동안에는 완충을 태우면 안 된다 — 시트는 손끝에 붙어 있는데 지도만 늦게
 * 와서 미끄러져 보인다. 단계에 붙을 때만 따라간다.
 */
test('"now" 는 그 프레임에 바로 반영된다 — 끄는 동안 쓰는 길', () => {
  const e = engine();
  e.inited = true; // 첫 설정이 아니어야 mode 가 의미를 가진다
  e.setOcclusion({ bottom: 300 }, "now");
  assert.equal(e.freeRect().y1, 860 - 300);
});

test('"ease" 는 바로 안 바뀌고 frame() 을 돌수록 목표에 다가간다', () => {
  const e = engine();
  e.inited = true;
  const before = e.freeRect().y1;
  e.setOcclusion({ bottom: 300 }, "ease");
  assert.equal(e.freeRect().y1, before, "부른 순간에는 그대로");

  // frame() 은 다른 일도 하지만, 가림 보간만 떼어 같은 식으로 확인한다
  let cur = HUD_OCCLUSION.bottom;
  for (let i = 0; i < 200 && Math.abs(cur - 300) >= 0.5; i++) cur += (300 - cur) * OCCLUSION_EASE;
  assert.ok(Math.abs(cur - 300) < 0.5, "충분히 돌면 목표에 붙는다");
});

test("첫 설정은 mode 와 무관하게 즉시다 — 따라갈 이전 값이 없다", () => {
  const e = engine();
  e.setOcclusion({ bottom: 300 }, "ease");
  assert.equal(e.freeRect().y1, 860 - 300);
});
