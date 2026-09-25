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
  assert.equal(e.isHomeTraveling(), false);
  assert.equal(e.goHome(), "moved");
  assert.ok(e.anim, "전환이 시작됐다");
  assert.equal(e.anim.layer, 0, "먼저 최상단으로 떠오른다");
  assert.equal(e.isHomeTraveling(), true, "누른 순간부터 옮겨 가는 중 — 화면은 이걸 보고 패널을 접는다");
  let now = settle(e, t);
  assert.equal(e.layer, 1, "떠오른 뒤 바로 다시 파고들어 2겹이다");
  assert.deepEqual(e.boxes, [LEFT], "왼쪽 갈래로");
  // settle 한 번이 두 전환을 다 끝낼 만큼 길다 — 아직 전환이 남았을 때만 "가는 중" 이어야 한다
  assert.equal(e.isHomeTraveling(), e.anim != null, "파고드는 동안은 가는 중, 끝났으면 아니다");
  now = settle(e, now);
  assert.equal(e.anim, null);
  assert.equal(e.isHomeTraveling(), false, "도착 — 패널이 다시 펴질 순간");
  assert.equal(e.playingElsewhere(), false, "이제 내 자리다");
  assert.equal(e.myId, MINE);
});

/**
 * **실제로 깨지던 길.** 겹이 바뀔 때마다 presence join 의 답(`PRESENCE_JOINED`)이 내 곡을 되돌려 주고
 * 스토어가 `setMy` 를 부른다 — 그때 `home` 이 지금 경로로 덮이면 "재생 때 경로" 가 사라진다.
 */
test("겹을 옮긴 뒤 같은 곡으로 setMy 가 다시 와도 재생 때 경로는 그대로다", () => {
  const { e, t } = scenario();
  e.setMy(MINE); // 오른쪽 갈래에서 PRESENCE_JOINED 가 같은 곡을 되돌려 줬다
  assert.deepEqual(e.home, { musicId: MINE, boxes: [LEFT] }, "오른쪽 경로로 덮이지 않는다");
  assert.equal(e.playingElsewhere(), true);
  assert.equal(e.goHome(), "moved");
  assert.equal(e.anim && e.anim.layer, 0, "여전히 최상단으로 떠오른다");
  let now = settle(e, t);
  now = settle(e, now);
  assert.deepEqual(e.boxes, [LEFT]);
  // 곡이 바뀌면 그때는 새 경로가 기록된다
  const OTHER = songs.find((s) => s.pc[0] === 1.4 && s.pc[1] === 0).musicId;
  e.setMy(OTHER);
  assert.equal(e.home.musicId, OTHER);
  assert.deepEqual(e.home.boxes, [LEFT], "지금 경로(왼쪽)로 새로 적힌다");
});

/** 3→1→3 처럼 **한 번에** 오르내린다 — 중간 겹을 하나씩 밟지 않는다 (S15P21A405-670) */
test("두 겹 깊이의 자리로 돌아갈 때 떠오르기 한 번, 파고들기 한 번이다", () => {
  const LEFT2 = { layer: 1, xMin: -3, xMax: 3, yMin: -3, yMax: 3 };
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  drill(e, LEFT);
  t = settle(e, t);
  drill(e, LEFT2);
  t = settle(e, t);
  assert.equal(e.layer, 2);
  e.travelTo(MINE);
  t = settle(e, t);
  assert.deepEqual(e.home.boxes, [LEFT, LEFT2]);
  e.ascendTo(0);
  t = settle(e, t);
  drill(e, RIGHT);
  t = settle(e, t);
  assert.equal(e.layer, 1);

  // 전환이 몇 번, 어느 겹으로 시작되는지 센다 — settle 한 번에 두 전환이 다 끝나므로 상태로는 못 잰다
  const starts = [];
  const morph = e.morph.bind(e);
  e.morph = (layer, cam, subset, big, ...rest) => {
    starts.push({ layer, big });
    return morph(layer, cam, subset, big, ...rest);
  };
  assert.equal(e.goHome(), "moved");
  assert.equal(e.anim.layer, 0, "한 번에 최상단으로");
  t = settle(e, t);
  t = settle(e, t);
  assert.equal(e.anim, null);
  assert.deepEqual(starts, [
    { layer: 0, big: "내 위치 찾아가는 중" },
    { layer: 2, big: "내 위치 찾아가는 중" },
  ], "떠오르기 한 번(→0), 파고들기 한 번(→2) — 중간 1겹은 밟지 않고 자막은 한 줄");
  assert.equal(e.layer, 2);
  assert.deepEqual(e.boxes, [LEFT, LEFT2]);
  assert.deepEqual(e.stack.map((f) => f.layer), [0, 1], "휠로 한 겹씩 떠오를 프레임은 쌓여 있다");
  assert.equal(e.playingElsewhere(), false);
});
