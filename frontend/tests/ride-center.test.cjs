/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **남의 우주선을 타면 내가 한복판에 있어야 한다** (S15P21A405-576).
 *
 * 어긋나도 오류가 안 난다 — 그냥 화면이 조금 치우친 채로 돈다. 그래서 눈으로는
 * "왜 좀 이상하지" 로만 읽히고, 재보기 전에는 무엇이 틀렸는지 말할 수가 없다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { FOLLOW } = require("../src/constants/map.ts");

const W = 1280;
const H = 800;

const pt = (id, x, y) => ({ musicId: id, pc: [x, y, ...Array(14).fill(0)], genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null });
/** 7x7 격자. 한 홉이 화면을 가로지를 만큼 널찍하게 */
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));
const HOME = 25; // 격자 한가운데 (0, 0)
const FAR = 4; // 왼쪽 끝 (-2.1, 0)

const leader = (musicId) => ({ email: "L", nickname: "L", isOnline: true, isPublic: true, musicId, viewingMusicId: musicId, x: 0, y: 0, avatarSeed: [0.5], genreId: 1, riderCount: 0 });

/** 여유 사각형 한복판에서 몇 px 떨어졌나 */
function offCenter(e, x, y) {
  const s = e.worldToScreen(x, y);
  const fr = e.freeRect();
  return Math.hypot(s.px - fr.cx, s.py - fr.cy);
}
const starOff = (e, id) => { const w = e.worldOf(id); return offCenter(e, w.x, w.y); };
const meOff = (e) => offCenter(e, e.me.x, e.me.y);

/** 탑승하고 카메라가 인솔자 자리에 자리잡을 때까지 돌린다 */
function board() {
  const e = new MapEngine();
  e.setSize(W, H);
  e.setLayerSongs(0, songs);
  let t = performance.now();
  e.frame(t);
  e.startFollow(leader(HOME), true);
  for (let k = 0; k < 200; k++) e.frame((t += 16));
  return { e, t };
}

/**
 * 인솔자가 곡을 옮기고, 우주선이 다 날아올 때까지 돌린다.
 *
 * `mv.t0` 를 다시 박는 이유: `rideTo` 안의 호는 진짜 `performance.now()` 로 시각을 재는데,
 * 이 테스트의 시계는 프레임을 세어 앞질러 가 있다. 안 맞추면 비행이 시작하자마자 끝난 것으로 읽힌다.
 */
function flyTo(e, t, toId) {
  e.rideTo(toId);
  e.follow.mv.t0 = t;
  for (let k = 0; k <= FOLLOW.moveMs / 16; k++) e.frame((t += 16));
  return t;
}

test("비행이 끝나면 내 표식이 도착한 별 위에 선다", () => {
  const { e, t } = board();
  flyTo(e, t, FAR);
  const w = e.worldOf(FAR);
  const gap = Math.hypot(e.me.x - w.x, e.me.y - w.y) * e.cam.s;
  // 선미 뒤 6% 를 안 거두면 여기서 72px 가 나왔다 — 곡을 옮길 때마다 같은 만큼 어긋난다
  assert.ok(gap < 0.5, `도착지에서 ${gap.toFixed(1)}px 떨어져 있다`);
  assert.ok(meOff(e) < 1, `내 표식이 한복판에서 ${meOff(e).toFixed(1)}px 떨어져 있다`);
});

test("서버가 모는 길 — 상세 없이 바로 재생해도 도착 때는 한복판이다", () => {
  const { e, t } = board();
  // `RIDE_PANEL` 없이 `RIDE_TRACK` 만 온다. 명세가 전제한 "뷰가 먼저 이동" 이 없는 경우다
  flyTo(e, t, FAR);
  assert.ok(starOff(e, FAR) < 1, `목적지 별이 ${starOff(e, FAR).toFixed(0)}px 밖에 있다`);
});

/**
 * 명세(SOCIAL-07)가 말하는 순서. 뷰가 먼저 가 있으므로 비행 중에는 한 픽셀도 안 움직여야 한다.
 * 뷰 추적을 비행 중에도 돌리지만, 이미 그 자리라 같은 점으로 보간하는 셈이라 제자리다.
 */
test("상세를 먼저 열었으면 우주선이 오는 동안 뷰가 멈춰 있다", () => {
  const { e, t: t0 } = board();
  let t = t0;
  e.rideViewing(FAR);
  for (let k = 0; k < FOLLOW.viewToPlayMs / 16; k++) e.frame((t += 16));

  const before = { cx: e.cam.cx, cy: e.cam.cy };
  t = flyTo(e, t, FAR);
  const moved = Math.hypot(e.cam.cx - before.cx, e.cam.cy - before.cy) * e.cam.s;
  assert.ok(moved < 1, `비행 중 뷰가 ${moved.toFixed(1)}px 움직였다`);
});

test("탑승하면 인솔자 자리가 한복판으로 온다", () => {
  const { e } = board();
  assert.ok(starOff(e, HOME) < 1);
  assert.ok(meOff(e) < 1);
});

/**
 * 탑승을 누르는 순간의 화면은 인솔자 곡을 모를 수 있어 **내 곡을 임시로** 쓴다 (프로필에서 탈 때는 늘 그렇다).
 * 응답이 진짜 곡을 가져오면 같은 사람·같은 겹이라 `startFollow` 가 "다시 걸지 않는" 길로 들어오는데,
 * 예전에는 거기서 표시 정보만 갱신하고 비켜나 우주선도 뷰도 임시 곡에 남았다 — 새로고침해야 가운데로 왔다 (S15P21A405-676).
 */
test("탑승 응답이 진짜 곡을 가져오면 임시 곡의 우주선이 그리로 날고 뷰도 따라간다", () => {
  const { e, t } = board(); // 임시 곡(HOME)에 세워 둔 상태
  e.startFollow(leader(FAR), true); // 같은 사람·같은 겹 — 진짜 곡이 도착했다
  assert.ok(e.follow.mv && e.follow.mv.toId === FAR, "우주선이 진짜 곡으로 난다");
  e.follow.mv.t0 = t;
  let now = t;
  for (let k = 0; k <= FOLLOW.moveMs / 16 + 200; k++) e.frame((now += 16));
  assert.equal(e.follow.playingMusicId, FAR);
  assert.ok(starOff(e, FAR) < 1, `인솔자 곡이 한복판에서 ${starOff(e, FAR).toFixed(0)}px 떨어져 있다`);
  assert.ok(meOff(e) < 1, `내 표식이 한복판에서 ${meOff(e).toFixed(1)}px 떨어져 있다`);
});

test("이미 그 곡으로 날고 있으면(RIDE_TRACK) 다시 걸어도 비행을 지우지 않는다", () => {
  const { e, t } = board();
  e.rideTo(FAR);
  const mv = e.follow.mv;
  e.startFollow(leader(FAR), true);
  assert.equal(e.follow.mv, mv, "같은 비행이 그대로다");
  void t;
});
