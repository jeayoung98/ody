/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 내 위치로 가기가 **갈래를 따라** 간다 (S15P21A405-670). 왼쪽 갈래 2겹에서 튼 곡은 오른쪽 갈래 2겹에서
 * 좌표가 안에 있어도 "여기 있다" 가 아니어야 하고, 내 위치로 가기는 최상단까지 떠올랐다 왼쪽으로 파고들어야 한다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { DRILL } = require("../src/constants/map.ts");

const pt = (id, x, y) => ({ musicId: id, pc: Array.from({ length: 16 }, (_, k) => (k % 2 ? y : x)), genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null, playable: true });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
/** x = -1.4 (gx = -2), y = 0 → 왼쪽에 있는 곡 */
const MINE = songs.find((s) => s.pc[0] === -1.4 && s.pc[1] === 0).musicId;
const LEFT = { layer: 0, xMin: -3, xMax: -0.1, yMin: -3, yMax: 3 };
/** 오른쪽으로 파고든 사각형이 넓어 내 곡 좌표(-1.4)를 품는다 — 실제로 흔한 경우 */
const RIGHT = { layer: 0, xMin: -2.5, xMax: 3, yMin: -3, yMax: 3 };

function settle(e, t) {
  for (let k = 0; k <= DRILL.morphMs / 16 + 40; k++) e.frame((t += 16));
  return t;
}
/** 파고들기 — 휠·게이트 없이 엔진 내부 경로로 곧장 (descend 가 하는 일과 같다) */
function drill(e, box) {
  e.stack.push({ layer: e.layer, cam: { ...e.cam }, subset: e.subset.slice(), entryS: e.entryS });
  e.boxes = [...e.boxes, box];
  const nl = e.layer + 1;
  const ns = e.maskForBoxes(e.boxes, nl);
  e.morph(nl, e.fitCam(nl, ns, e.fitAnchor(ns, nl)), ns, "drill");
}

function scenario() {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  drill(e, LEFT);
  t = settle(e, t);
  assert.equal(e.layer, 1);
  e.travelTo(MINE);
  t = settle(e, t);
  assert.deepEqual(e.home, { musicId: MINE, boxes: [LEFT] }, "재생 때 경로가 남는다");
  e.ascendTo(0);
  t = settle(e, t);
  assert.equal(e.layer, 0);
  drill(e, RIGHT);
  t = settle(e, t);
  assert.equal(e.layer, 1);
  assert.deepEqual(e.boxes, [RIGHT]);
  return { e, t };
}

test("오른쪽 갈래에서는 내 곡이 좌표상 안에 있어도 '다른 갈래' 다", () => {
  const { e } = scenario();
  assert.equal(e.isAlive(MINE), true, "서버(여기선 사각형)가 그 곡을 준다 — 별 자체는 뜬다");
  assert.equal(e.playingElsewhere(), true, "하지만 내 자리는 여기가 아니다");
  const arrow = e.meArrow();
  assert.ok(arrow && arrow.elsewhere, "표식은 가장자리 화살표다");
});

test("내 위치로 가기: 최상단까지 떠올랐다가 왼쪽으로 다시 파고든다", () => {
  const { e, t } = scenario();
  assert.equal(e.goHome(), "moved");
  assert.ok(e.anim, "전환이 시작됐다");
  assert.equal(e.anim.layer, 0, "먼저 최상단으로 떠오른다");
  let now = settle(e, t);
  assert.equal(e.layer, 1, "떠오른 뒤 바로 다시 파고들어 2겹이다");
  assert.deepEqual(e.boxes, [LEFT], "왼쪽 갈래로");
  now = settle(e, now);
  assert.equal(e.anim, null);
  assert.equal(e.playingElsewhere(), false, "이제 내 자리다");
  assert.equal(e.myId, MINE);
});
