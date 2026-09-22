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

test("커버 자리는 앨범 ID 있는 곡부터, 그다음 재생수, 그다음 받은 순서", () => {
  const { byCoverPriority } = require("../src/components/map/render/cover-spread.ts");
  // weight 가 전부 0 인 실데이터를 흉내 낸다 — 그때 남는 기준이 '받은 순서' 다
  const songs = [
    { id: "a", album: false, w: 0 },
    { id: "b", album: true, w: 0 },
    { id: "c", album: false, w: 9 },
    { id: "d", album: true, w: 0 },
    { id: "e", album: true, w: 5 },
  ];
  const order = [...songs].sort(byCoverPriority((s) => s.album, (s) => s.w)).map((s) => s.id);

  assert.deepEqual(order, ["e", "b", "d", "c", "a"]);
  assert.ok(order.indexOf("b") < order.indexOf("c"), "재생수 9 라도 앨범 ID 없으면 뒤로 간다");
  assert.ok(order.indexOf("b") < order.indexOf("d"), "동점이면 받은 순서를 지킨다");
});

// ── 지도 위 사람에게도 같은 규칙을 쓴다 (S15P21A405-542) ───────────────────
// 사람은 비슷한 곡끼리 붙어 서는데(그게 이 지도의 원리다), 예전에는 받은 순서대로 집어서
// 한쪽에 몰린 무리가 자리를 다 차지하고 그 밖이 비어 보였다.

test("지난 프레임에 서 있던 사람이 같은 칸을 다투면 이긴다 — 밀 때 안 깜빡인다", () => {
  const { keptFirst } = require("../src/components/map/render/cover-spread.ts");
  const cands = [{ id: "new1" }, { id: "old" }, { id: "new2" }];
  const order = keptFirst(cands, (c) => c.id === "old");

  assert.deepEqual(order, [1, 0, 2], "서 있던 사람이 맨 앞, 나머지는 원래 순서 그대로");
  // 한 칸에 셋이 다 들어가는 경우 — spreadOrder 는 먼저 만난 것을 그 칸 주인으로 삼는다
  const at = () => ({ x: 30, y: 30 });
  const picked = spreadOrder(order, at, RECT, 12);
  assert.equal(picked[0], 1, "칸 주인이 그대로 'old' 여야 자리가 안 바뀐다");
});

test("한쪽에 몰린 사람 20명을 뽑아도 반대쪽이 통째로 비지 않는다", () => {
  // 왼쪽 위에 40명, 오른쪽 아래에 4명. 예전 규칙이면 앞 20명이 전부 왼쪽 위였다
  const pts = [];
  for (let i = 0; i < 40; i++) pts.push({ x: 40 + (i % 8) * 18, y: 40 + Math.floor(i / 8) * 18 });
  for (let i = 0; i < 4; i++) pts.push({ x: 1300 + i * 20, y: 760 });

  const order = keptFirstIdentity(pts.length);
  const picked = spreadOrder(order, (i) => pts[i], RECT, 20).slice(0, 20);
  const rightBottom = picked.filter((i) => i >= 40).length;

  assert.ok(rightBottom > 0, "오른쪽 아래 사람이 한 명도 안 뽑혔다 — 몰린 쪽이 다 차지했다");
  /**
   * **네 명이 다 뽑히지는 않는다.** 그 넷이 든 칸은 두 개뿐이고(1600x900 을 20칸으로 나누면
   * 한 칸이 266x225 다) 칸마다 하나씩만 앞세우기 때문이다. 한 칸에 몰린 나머지는 뒤로 밀리고,
   * 자리가 남을 때만 들어온다 — 그게 이 함수가 하는 일이고 여기서 고칠 것이 아니다.
   */
  assert.equal(rightBottom, 2, "떨어진 무리가 든 칸 수만큼은 반드시 뽑힌다");
  const leftTop = picked.filter((i) => i < 40).length;
  assert.ok(leftTop < 40, "몰린 쪽이 상한을 다 먹으면 안 된다");
});

/** 아직 아무도 안 서 있던 첫 프레임 */
function keptFirstIdentity(n) {
  const { keptFirst } = require("../src/components/map/render/cover-spread.ts");
  return keptFirst(Array.from({ length: n }, (_, i) => i), () => false);
}
