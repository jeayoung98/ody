/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **주변 탐색 라벨은 서로 가리지 않는다** (S15P21A405-697).
 *
 * 제목·가수를 자르지 않고 다 보이게 두는 대신 별 자리를 민다. 틀리면 긴 제목 둘이 붙을 때 글자가 포개져 둘 다 못 읽는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { approxTextWidth, separateLabels } = require("../src/components/map/engine/probe-layout.ts");

const GAP = 8;
const rect = (b, p) => ({ x0: p.x - b.w / 2, x1: p.x + b.w / 2, y0: p.y + b.top, y1: p.y + b.bottom });
/** 두 상자가 gap 보다 가까우면 true */
const tooClose = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + GAP > 1e-6 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + GAP > 1e-6;

function assertApart(boxes, pos) {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = rect(boxes[i], pos.get(boxes[i].id));
      const b = rect(boxes[j], pos.get(boxes[j].id));
      assert.ok(!tooClose(a, b), `${boxes[i].id}·${boxes[j].id} 가 ${GAP}px 안으로 붙었다`);
    }
  }
}

test("겹친 긴 라벨 둘을 최소 간격만큼 떼어 놓는다", () => {
  const boxes = [
    { id: 1, x: 0, y: 0, w: 220, top: -10, bottom: 64 },
    { id: 2, x: 30, y: 10, w: 240, top: -10, bottom: 64 },
  ];
  assertApart(boxes, separateLabels(boxes, GAP));
});

test("고정된 가운데 라벨은 안 움직이고 이웃만 밀린다", () => {
  const boxes = [
    { id: 0, x: 0, y: 0, w: 200, top: -26, bottom: 66, fixed: true },
    { id: 1, x: 20, y: 30, w: 180, top: -10, bottom: 64 },
  ];
  const pos = separateLabels(boxes, GAP);
  assert.deepEqual(pos.get(0), { x: 0, y: 0 });
  assertApart(boxes, pos);
});

test("고리 한 바퀴(12곡)에 긴 제목이 섞여도 아무 쌍도 겹치지 않는다", () => {
  const boxes = [{ id: 0, x: 0, y: 0, w: 210, top: -26, bottom: 66, fixed: true }];
  for (let k = 0; k < 12; k++) {
    const ang = -Math.PI / 2 + (k / 12) * Math.PI * 2;
    const R = k % 2 === 0 ? 0.58 * 260 : 260;
    boxes.push({ id: k + 1, x: Math.cos(ang) * R, y: Math.sin(ang) * R, w: k % 3 === 0 ? 260 : 120, top: -10, bottom: 64 });
  }
  assertApart(boxes, separateLabels(boxes, GAP));
});

test("이미 떨어져 있으면 건드리지 않는다", () => {
  const boxes = [
    { id: 1, x: -300, y: 0, w: 100, top: -10, bottom: 64 },
    { id: 2, x: 300, y: 0, w: 100, top: -10, bottom: 64 },
  ];
  const pos = separateLabels(boxes, GAP);
  assert.deepEqual(pos.get(1), { x: -300, y: 0 });
  assert.deepEqual(pos.get(2), { x: 300, y: 0 });
});

/**
 * **폰에서는 남은 화면 안에 가둔다** (S15P21A405-715). 360px 폰 크기의 경계에서 고리 한 바퀴를 민다 —
 * 틀리면 끝 라벨이 화면 밖이나 시트 밑으로 나가 잘린다.
 */
const PHONE = { x0: -172, x1: 172, y0: -187, y1: 187 };
const inside = (b, p, r) =>
  p.x - b.w / 2 >= r.x0 - 1e-6 && p.x + b.w / 2 <= r.x1 + 1e-6 && p.y + b.top >= r.y0 - 1e-6 && p.y + b.bottom <= r.y1 + 1e-6;

test("경계를 주면 고리 한 바퀴가 다 그 안에 머문다", () => {
  const boxes = [{ id: 0, x: 0, y: 0, w: 200, top: -26, bottom: 66, fixed: true }];
  for (let k = 0; k < 10; k++) {
    const ang = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const R = k % 2 === 0 ? 0.58 * 130 : 130;
    boxes.push({ id: k + 1, x: Math.cos(ang) * R, y: Math.sin(ang) * R, w: k % 3 === 0 ? 163 : 110, top: -10, bottom: 66 });
  }
  const pos = separateLabels(boxes, GAP, undefined, PHONE);
  for (const b of boxes.slice(1)) assert.ok(inside(b, pos.get(b.id), PHONE), `${b.id} 가 경계 밖으로 나갔다 ${JSON.stringify(pos.get(b.id))}`);
});

test("경계보다 넓은 상자는 가운데에 둔다 — 어느 끝에 붙여도 반은 잘린다", () => {
  const boxes = [{ id: 1, x: 150, y: 0, w: 400, top: -10, bottom: 66 }];
  assert.equal(separateLabels(boxes, GAP, undefined, PHONE).get(1).x, 0);
});

test("고정된 가운데 라벨은 경계가 있어도 안 움직인다", () => {
  const boxes = [
    { id: 0, x: 0, y: 0, w: 200, top: -26, bottom: 66, fixed: true },
    { id: 1, x: 170, y: 0, w: 120, top: -10, bottom: 66 },
  ];
  const pos = separateLabels(boxes, GAP, undefined, PHONE);
  assert.deepEqual(pos.get(0), { x: 0, y: 0 });
  assert.ok(inside(boxes[1], pos.get(1), PHONE));
});

test("경계를 안 주면 예전처럼 밖으로도 민다 — 넓은 화면은 그대로다", () => {
  const boxes = [{ id: 1, x: 300, y: 0, w: 200, top: -10, bottom: 66 }];
  assert.deepEqual(separateLabels(boxes, GAP).get(1), { x: 300, y: 0 });
});

test("글자 폭 어림 — 한글은 영문보다 넓게 잡는다", () => {
  assert.ok(approxTextWidth("가나다", 13) > approxTextWidth("abc", 13));
  assert.equal(approxTextWidth("", 13), 0);
});
