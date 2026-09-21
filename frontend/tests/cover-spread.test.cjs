/* eslint-disable @typescript-eslint/no-require-imports */
// 지도 커버가 화면에 고루 퍼지는가 (S15P21A405-518).
// 한쪽에 몰리는 증상으로 두 번 되돌아온 규칙이라 수치로 묶어 둔다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gridFor, cellOf, spreadOrder } = require("../src/components/map/render/cover-spread.ts");

const RECT = { x0: 0, y0: 0, x1: 1600, y1: 900 };

test("칸 나누기는 화면 비율을 따라간다 — 가로로 길면 열이 많다", () => {
  const { cols, rows } = gridFor(20, RECT);
  assert.ok(cols > rows, `가로가 더 긴 화면인데 cols=${cols} rows=${rows}`);
  assert.ok(cols * rows >= 20, "칸이 뽑을 개수보다 적으면 애초에 다 못 펼친다");
});

test("가장자리 점도 칸 안에 들어온다 — 경계에서 배열 밖을 짚지 않는다", () => {
  const { cols, rows } = gridFor(12, RECT);
  const last = cols * rows - 1;
  assert.equal(cellOf(0, 0, RECT, cols, rows), 0);
  assert.equal(cellOf(1600, 900, RECT, cols, rows), last, "오른쪽 아래 끝");
  assert.equal(cellOf(99999, 99999, RECT, cols, rows), last, "밖으로 나가도 마지막 칸으로 붙는다");
});

test("한쪽에 몰린 후보는 서로 다른 칸부터 내주고 나머지는 뒤로 민다", () => {
  // 전부 화면 왼쪽 1/8 안에 뭉쳐 있는 후보 60개 — 예전에는 이대로 앞에서부터 집혀 몰렸다
  const clustered = Array.from({ length: 60 }, (_, i) => i);
  const at = (i) => ({ x: 20 + (i % 10) * 15, y: 20 + Math.floor(i / 10) * 60 });
  const { cols, rows } = gridFor(12, RECT);
  const order = spreadOrder(clustered, at, RECT, 12);

  const cells = order.map((i) => cellOf(at(i).x, at(i).y, RECT, cols, rows));
  const distinct = new Set(cells).size;
  assert.equal(new Set(cells.slice(0, distinct)).size, distinct, "앞쪽 = 칸마다 하나씩");

  /**
   * **별이 없는 칸에는 커버도 못 놓는다.** 후보가 왼쪽에만 있으면 고를 수 있는 칸도 그만큼뿐이라
   * 12개를 채우려면 같은 칸을 다시 쓸 수밖에 없다 — 그건 이 함수가 아니라 지도의 사정이다.
   * 그래도 **몰린 것부터 집지는 않는다**: 서로 다른 칸이 먼저 나오고 중복은 뒤로 밀린다.
   */
  assert.ok(distinct < 12, `왼쪽에만 뭉친 입력이라 칸이 12개보다 적어야 맞다 (distinct=${distinct})`);
  assert.equal(order.length, 60, "버리지는 않는다 — 모자라면 뒤엣것으로 메운다");
});

test("고루 흩뿌린 후보는 앞쪽이 화면 전체를 덮는다", () => {
  const { cols, rows } = gridFor(12, RECT);
  // 칸마다 두 개씩 놓는다
  const pts = [];
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++)
      for (let k = 0; k < 2; k++) pts.push({ x: (cx + 0.3 + k * 0.2) * (1600 / cols), y: (cy + 0.5) * (900 / rows) });
  const order = spreadOrder(
    pts.map((_, i) => i),
    (i) => pts[i],
    RECT,
    12,
  );
  const head = order.slice(0, cols * rows).map((i) => cellOf(pts[i].x, pts[i].y, RECT, cols, rows));
  assert.equal(new Set(head).size, cols * rows, "모든 칸이 한 번씩 나와야 한다");
});

test("이미 커버가 선 칸은 건너뛴다 — 새 커버는 빈 쪽으로 간다", () => {
  const { cols, rows } = gridFor(12, RECT);
  const pts = [
    { x: 50, y: 50 }, // 0번 칸
    { x: 60, y: 60 }, // 0번 칸
    { x: 1500, y: 800 }, // 마지막 칸
  ];
  const at = (i) => pts[i];
  const taken = new Set([cellOf(50, 50, RECT, cols, rows)]);
  const order = spreadOrder([0, 1, 2], at, RECT, 12, taken);

  assert.deepEqual(order, [2], "이미 찬 칸의 후보는 아예 빠진다");
});
