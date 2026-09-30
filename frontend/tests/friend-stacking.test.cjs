/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **지도에서 겹친 사람을 버리지 않고 묶는다** (S15P21A405-550).
 *
 * 예전에는 주변 칸이 차 있으면 그냥 건너뛰었다. 같은 곡을 들으면 좌표가 완전히 같아서
 * **접속자가 여럿인데 화면에는 한 명만** 떴다. 오류도 로그도 없어서 "왜 안 보이지" 로만 보인다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

/** 화면 좌표를 그대로 주는 엔진. 카메라·상주 집합 없이 고르기 규칙만 본다 */
function engine(people) {
  const e = new MapEngine();
  e.H = 768;
  e.freeRect = () => ({ x0: 0, y0: 0, x1: 1024, y1: 768, cx: 512, cy: 384 });
  e.worldToScreen = (x, y) => ({ px: x, py: y });
  e.anchorFor = (u) => ({ x: u.x, y: u.y });
  e.friends = people;
  e.updateFriends();
  return e;
}

/** x·y 는 곧 화면 좌표다 */
const person = (email, x, y) => ({ email, nickname: email, isOnline: true, musicId: 1, x, y, avatarSeed: [0.5], genreId: 1, riderCount: 0 });

/** 표식 + 묶인 사람 = 화면에 셈어진 전원 */
const counted = (e) => e.visFriends.reduce((n, v) => n + 1 + v.stacked.length, 0);

test("떨어져 있으면 각자 제 표식을 갖는다", () => {
  const e = engine([person("a", 200, 200), person("b", 600, 500)]);
  assert.equal(e.visFriends.length, 2);
  assert.deepEqual(e.visFriends.map((v) => v.stacked.length), [0, 0]);
});

test("같은 곡이면 좌표가 같다 — 버리지 않고 한 표식에 묶는다", () => {
  const e = engine([person("a", 300, 300), person("b", 300, 300), person("c", 300, 300)]);
  assert.equal(e.visFriends.length, 1, "표식은 하나");
  assert.equal(e.visFriends[0].stacked.length, 2, "나머지 둘이 묶여야 한다");
  assert.equal(counted(e), 3, "아무도 사라지면 안 된다");
});

test("붙어 있어도(58px 안) 묶이지 버려지지 않는다", () => {
  const e = engine([person("a", 300, 300), person("b", 330, 310)]);
  assert.equal(counted(e), 2);
  assert.equal(e.visFriends[0].stacked.length, 1);
});

test("혼자면 배지를 그릴 일이 없다 — 묶인 목록이 비어 있다", () => {
  const e = engine([person("solo", 400, 400)]);
  assert.deepEqual(e.visFriends[0].stacked, []);
});

test("20명을 넘겨도 한 명도 안 사라진다 — 예전 상한이 여기서 잘랐다", () => {
  const many = Array.from({ length: 50 }, (_, i) => person(`u${i}`, 300, 300));
  assert.equal(counted(engine(many)), 50);
});

test("흩어진 50명도 전원이 셈어진다", () => {
  // 200px 간격이면 서로 안 겹친다 — 표식이 50개가 되고 묶임은 없다
  const many = Array.from({ length: 50 }, (_, i) => person(`u${i}`, 100 + (i % 5) * 200, 100 + Math.floor(i / 5) * 60));
  const e = engine(many);
  assert.equal(counted(e), 50);
});

/**
 * 묶여 있던 사람을 따라가기 시작하면 **다음 프레임에 제 표식(우주선)으로 나와야 한다** (S15P21A405-625).
 * 배율이 같아 지난 배치를 재사용하는 길에서 이게 깨졌다 — 인솔자가 배지 숫자 속에 그대로 남았다.
 */
test("묶여 있던 사람이 인솔자가 되면 제 표식으로 올라온다", () => {
  const e = engine([person("a", 300, 300), person("b", 300, 300), person("c", 300, 300)]);
  assert.equal(e.visFriends[0].user.email, "a", "처음엔 a 가 대표고 b 는 묶여 있다");
  // 따라가기 시작 — 인솔자 자리는 비행이 정하므로 테스트가 직접 놓는다
  e.follow = { leader: e.friends[1] };
  e.friendPos.set("b", { x: 300, y: 300, heading: 0 });
  e.updateFriends();
  const leader = e.visFriends.find((v) => v.user.email === "b");
  assert.ok(leader, "b 가 제 표식으로 있어야 한다");
  assert.equal(leader.isLeader, true);
  assert.equal(counted(e), 3, "아무도 사라지면 안 된다");
});

test("화면 밖 사람은 여전히 후보가 아니다 — 겹침과 다른 문제라 이 티켓에서 안 건드렸다", () => {
  const e = engine([person("inside", 400, 400), person("outside", -500, 400)]);
  assert.equal(counted(e), 1);
});

/**
 * **곡 위에 선 표식은 혼자여도 펼쳐 가운데 곡을 비운다** (S15P21A405-727).
 * 사람은 듣는 곡의 별 위에 그려지고 판정은 사람을 먼저 보므로, 펼치지 않으면 그 곡을 누를 길이 없다.
 */
const { FRIEND_MARKER } = require("../src/constants/map.ts");

/** 화면 (300,300) 에 별 하나가 있는 엔진 */
function engineWithStar(people) {
  const e = engine(people);
  e.songs = [{ musicId: 1, title: "t", artist: "a" }];
  e.visible = [{ i: 0, px: 300, py: 300, r: 15 }];
  e.coverHits = [];
  return e;
}

test("곡 위의 혼자 표식을 펼치면 별 밖으로 비켜서고, 그 자리의 곡이 잡힌다", () => {
  const e = engineWithStar([person("a", 300, 300)]);
  assert.equal(e.hitFriend(300, 300)?.user.email, "a", "펼치기 전엔 사람이 별을 덮는다");
  e.expandStack("a");
  e.updateFriends();
  e.spreadExpandedStack();
  // 스프링이 끝난 뒤 자리를 본다
  e.expandedStack.since -= 10_000;
  e.updateFriends();
  e.spreadExpandedStack();
  const v = e.visFriends[0];
  assert.equal(v.spread, true, "갈라진 표식으로 표시된다 — 다시 펼치지 않는다");
  const d = Math.hypot(v.px - 300, v.py - 300);
  assert.ok(d > 15 + FRIEND_MARKER.radiusPx, `헬멧이 별 밖에 있어야 한다 (d=${d})`);
  assert.equal(e.hitFriend(300, 300), null, "가운데를 누르면 사람이 아니다");
  assert.equal(e.hitTest(300, 300)?.i, 0, "가운데를 누르면 곡이다");
});

test("밑에 곡이 없는 혼자 표식은 펼칠 것이 없어 접힌다", () => {
  const e = engine([person("a", 300, 300)]);
  e.songs = [];
  e.visible = [];
  e.coverHits = [];
  e.expandStack("a");
  e.updateFriends();
  e.spreadExpandedStack();
  assert.equal(e.expandedStack, null);
  assert.equal(e.visFriends[0].spread, undefined);
});
