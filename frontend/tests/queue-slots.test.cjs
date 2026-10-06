/* eslint-disable @typescript-eslint/no-require-imports */
// 우주선 뒤 줄의 자리 배치 (S15P21A405-676). 한 명이 따라오는데 헬멧이 둘이던 버그가 여기서 잡힌다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { queueSlots } = require("../src/components/map/render/queue-slots.ts");

const user = (email, imageUrl = null) => ({ email, nickname: email, imageUrl, isOnline: true, musicId: 0, viewingMusicId: 0, genreId: 0, meetingCount: 0, riderCount: 0, followingNickname: null, avatarSeed: [0, 0, 0, 0, 0, 0] });

test("내가 인솔자: 따라오는 사람 수만큼만 선다 — 나는 조종석이라 줄에 없다", () => {
  const slots = queueSlots({ me: null, riders: [user("a@ody.kr", "https://img/a.png")], count: 1 });
  assert.equal(slots.length, 1, "예전엔 '나' 한 칸이 더해져 둘이었다");
  assert.equal(slots[0].mine, false);
  assert.equal(slots[0].user.imageUrl, "https://img/a.png", "헬멧에 그 사람 사진");
});

test("내가 동승자: 맨 앞이 나고, 다른 동승자는 서버가 안 알려 줘서 나 혼자다 (A-86)", () => {
  const me = user("me", "https://img/me.png");
  const slots = queueSlots({ me, riders: [], count: 0 });
  assert.deepEqual(slots.map((s) => [s.mine, s.user.imageUrl]), [[true, "https://img/me.png"]]);
});

test("수는 아는데 사람을 모르면(새로고침 뒤·사진 조회 전) 모자란 만큼 빈 헬멧", () => {
  const slots = queueSlots({ me: null, riders: [user("a@ody.kr")], count: 3 });
  assert.equal(slots.length, 3);
  assert.deepEqual(slots.map((s) => s.user.email), ["a@ody.kr", "rider-1", "rider-2"]);
  assert.equal(queueSlots({ me: null, riders: [], count: 0 }).length, 0, "아무도 없으면 줄도 없다");
});

test("명단이 수보다 길면 수만큼만 — 최근에 탄 사람부터 (S15P21A405-707)", () => {
  // 인솔자 소켓이 다시 열리면 서버가 선단을 조용히 풀어, 다시 안 탄 사람(old)이 명단에 남는다
  const slots = queueSlots({ me: null, riders: [user("old@ody.kr"), user("new@ody.kr")], count: 1 });
  assert.deepEqual(slots.map((s) => s.user.email), ["new@ody.kr"], "예전엔 '1명' 인데 헬멧이 둘이었다");
  assert.equal(queueSlots({ me: null, riders: [user("a@ody.kr")], count: 0 }).length, 0, "수가 0 이면 줄도 없다");
});
