/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **상시 접속 계정의 팔로워 표시** (S15P21A405-683).
 *
 * 서버는 실제 follow 행만 센다. 이 계정들은 표시할 때만 보정값을 더한다 — 틀리면 일반 사용자 수가 부풀거나,
 * 새로 읽을 때마다 숫자가 튀어 보정한 게 드러난다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { botFollowerBonus, toUserProfile } = require("../src/lib/backend.ts");
const { BOT_FOLLOWER_BONUS } = require("../src/constants/profile.ts");

const detail = (over = {}) => ({
  email: "someone@example.com",
  name: null,
  nickname: "누군가",
  tutorialCompleted: true,
  lastActiveAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  imageUrl: null,
  followerCnt: 12,
  followingCnt: 3,
  isFollowing: false,
  isMe: false,
  ...over,
});

test("isBot 이 없으면 서버 수 그대로다 — 옛 배포에서 일반 사용자 수가 부풀면 안 된다", () => {
  const p = toUserProfile(detail());
  assert.equal(p.isBot, false);
  assert.equal(p.followerCount, 12);
});

test("isBot 이 false 면 서버 수 그대로다", () => {
  assert.equal(toUserProfile(detail({ isBot: false })).followerCount, 12);
});

test("isBot 이면 실제 수에 보정값을 더한다 — 누른 팔로우도 그대로 반영된다", () => {
  const p = toUserProfile(detail({ isBot: true }));
  assert.equal(p.isBot, true);
  assert.equal(p.followerCount, 12 + botFollowerBonus("someone@example.com"));
});

test("보정값은 범위 안이고, 같은 계정은 늘 같은 값이다", () => {
  for (let i = 0; i < 50; i++) {
    const email = `acct${i}@example.com`;
    const b = botFollowerBonus(email);
    assert.ok(b >= BOT_FOLLOWER_BONUS.min && b <= BOT_FOLLOWER_BONUS.max, `${email}: ${b}`);
    assert.equal(botFollowerBonus(email), b);
  }
});

test("계정마다 값이 갈린다 — 모두 같은 수를 더하면 티가 난다", () => {
  const values = new Set(Array.from({ length: 20 }, (_, i) => botFollowerBonus(`acct${i}@example.com`)));
  assert.ok(values.size >= 10, `서로 다른 값이 ${values.size}개뿐이다`);
});
