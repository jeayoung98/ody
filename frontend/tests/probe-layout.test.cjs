/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **주변 탐색 라벨은 서로 가리지 않는다** (S15P21A405-697).
 *
 * 제목·가수를 자르지 않고 다 보이게 두는 대신 별 자리를 민다. 틀리면 긴 제목 둘이 붙을 때 글자가 포개져 둘 다 못 읽는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { approxTextWidth, cullLabels, placeLabels, separateLabels } = require("../src/components/map/engine/probe-layout.ts");

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

/**
 * **폰은 밀지 않고 빈자리에 놓는다** (S15P21A405-715). 360px 폰의 남은 화면에서는 미는 방식이 겹친 채 끝났다 —
 * 앞 순위부터 가장 가까운 빈자리를 차지하고, 못 찾은 라벨은 제자리에 두어 그리는 쪽이 글자를 숨긴다(`cullLabels`).
 */
const PGAP = 4;
/** 순서대로 보며, 먼저 자리 잡은 것과 부딪히지 않는 라벨만 "놓였다" 로 센다 (placeLabels 가 약속하는 것) */
function acceptedOf(boxes, pos) {
  const ok = [];
  for (const b of boxes) {
    const r = rect(b, pos.get(b.id));
    const hit = ok.some((o) => Math.min(o.x1, r.x1) - Math.max(o.x0, r.x0) + PGAP > 1e-6 && Math.min(o.y1, r.y1) - Math.max(o.y0, r.y0) + PGAP > 1e-6);
    if (!hit) ok.push(r);
  }
  return ok.length;
}

test("폰 배치: 고리 한 바퀴가 다 경계 안이고, 놓인 라벨끼리는 안 겹친다", () => {
  const boxes = [{ id: 0, x: 0, y: 0, w: 120, top: -25, bottom: 50, fixed: true }];
  for (let k = 0; k < 10; k++) {
    const ang = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const R = k % 2 === 0 ? 0.58 * 127 : 127;
    boxes.push({ id: k + 1, x: Math.cos(ang) * R, y: Math.sin(ang) * R, w: k % 3 === 0 ? 120 : 80, top: -10, bottom: 34 });
  }
  const pos = placeLabels(boxes, PGAP, PHONE, 115);
  for (const b of boxes.slice(1)) assert.ok(inside(b, pos.get(b.id), PHONE), `${b.id} 가 경계 밖 ${JSON.stringify(pos.get(b.id))}`);
  // 한 줄 라벨 열 개면 360 × 374 에 다 놓인다 — 하나라도 못 놓이면 글자가 숨는다
  assert.equal(acceptedOf(boxes, pos), boxes.length);
});

test("폰 배치: 빈자리면 안 움직이고, 막혔으면 가장 가까운 빈자리로 간다", () => {
  const boxes = [
    { id: 1, x: 0, y: 0, w: 100, top: -10, bottom: 34 },
    { id: 2, x: 0, y: 0, w: 100, top: -10, bottom: 34 },
  ];
  const pos = placeLabels(boxes, PGAP, PHONE, 120);
  assert.deepEqual(pos.get(1), { x: 0, y: 0 }, "앞 순위는 제자리");
  const p = pos.get(2);
  // 겹침을 푸는 가장 짧은 거리 = 높이(44) + 간격(4). 격자(4px)라 그 이상 가장 가까운 칸
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 48) < 1e-6, `2 가 ${JSON.stringify(p)} 로 갔다`);
  assert.equal(acceptedOf(boxes, pos), 2);
});

test("폰 배치: 한도 안에 빈자리가 없으면 경계 안 제자리에 둔다 — 그 라벨은 글자가 숨는다", () => {
  const boxes = [
    { id: 0, x: 0, y: 0, w: 300, top: -40, bottom: 40, fixed: true },
    { id: 1, x: 10, y: 10, w: 100, top: -10, bottom: 34 },
  ];
  assert.deepEqual(placeLabels(boxes, PGAP, PHONE, 20).get(1), { x: 10, y: 10 });
});

test("폰 배치: 라벨 자리가 없으면 별만이라도 빈 곳에 — 다른 라벨 밑에 깔리지 않는다", () => {
  // 360px 폰에서 실제로 났던 것: 숨은 10위의 별이 9위 제목 상자 안에 그려졌다
  const STAR = { w: 24, top: -12, bottom: 12 };
  const boxes = [
    { id: 1, x: 0, y: 0, w: 150, top: -10, bottom: 34 },
    { id: 2, x: 0, y: 19, w: 150, top: -10, bottom: 34 },
  ];
  const pos = placeLabels(boxes, PGAP, { x0: -80, x1: 80, y0: -12, y1: 80 }, 40, STAR);
  const p = pos.get(2);
  const a = rect(boxes[0], pos.get(1));
  const s = { x0: p.x - 12, x1: p.x + 12, y0: p.y - 12, y1: p.y + 12 };
  const apart = Math.min(a.x1, s.x1) - Math.max(a.x0, s.x0) + PGAP <= 1e-6 || Math.min(a.y1, s.y1) - Math.max(a.y0, s.y0) + PGAP <= 1e-6;
  assert.ok(apart, `2 의 별 ${JSON.stringify(p)} 이 1 의 라벨 ${JSON.stringify(a)} 에 깔렸다`);
});

test("폰 배치: 고정 상자는 경계와 상관없이 그 자리다", () => {
  const boxes = [
    { id: 0, x: 0, y: 0, w: 200, top: -25, bottom: 50, fixed: true },
    { id: 1, x: 0, y: 30, w: 100, top: -10, bottom: 34 },
  ];
  const pos = placeLabels(boxes, PGAP, PHONE, 120);
  assert.deepEqual(pos.get(0), { x: 0, y: 0 });
  assert.equal(acceptedOf(boxes, pos), 2);
});

test("숨김: 순서가 우선순위다 — 앞과 부딪히면 숨기고, 숨긴 라벨은 자리를 안 차지한다", () => {
  const r = (id, x0, x1, y0, y1, keep) => ({ id, x0, x1, y0, y1, keep });
  const hidden = cullLabels([r(1, 0, 100, 0, 40), r(2, 50, 150, 20, 60), r(3, 110, 200, 0, 40)], 0);
  // 2 는 1 과 부딪혀 숨고, 3 은 숨은 2 와만 겹치므로 보인다
  assert.deepEqual([...hidden], [2]);
});

test("숨김: keep(가운데·선택한 곡)은 늦게 와도 늘 보이고 앞 라벨을 가린다", () => {
  const r = (id, x0, x1, y0, y1, keep) => ({ id, x0, x1, y0, y1, keep });
  const hidden = cullLabels([r(1, 0, 100, 0, 40), r(9, 20, 80, 10, 30, true)], 0);
  assert.deepEqual([...hidden], [1]);
});

test("글자 폭 어림 — 한글은 영문보다 넓게 잡는다", () => {
  assert.ok(approxTextWidth("가나다", 13) > approxTextWidth("abc", 13));
  assert.equal(approxTextWidth("", 13), 0);
});
