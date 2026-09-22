/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 인증 실연동에서 프론트가 **직접 계산하는** 두 가지 (S15P21A405-462).
 *
 * 백엔드에 본인 조회 API 가 없어서 토큰에서 이메일을 꺼내고(`emailFromToken`), 프로필도
 * 응답에 없는 값을 우리가 채운다(`toUserProfile`). 둘 다 조용히 틀리는 종류라 — 엉뚱한 사람의
 * 마이페이지를 보거나, 없는 통계가 그럴듯한 숫자로 보이거나 — 여기서 못을 박아 둔다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { emailFromToken, toUserProfile, toUser } = require("../src/lib/backend.ts");

/** 서명은 아무 값이나 — 우리는 payload 만 읽고 검증은 백엔드가 한다 */
const jwt = (payload) => `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const req = (auth) => new Request("http://localhost/bff/auth/me", auth ? { headers: { authorization: auth } } : undefined);

test("액세스 토큰의 sub 를 이메일로 꺼낸다", () => {
  assert.equal(emailFromToken(req(`Bearer ${jwt({ sub: "me@ody.app", tokenType: "access" })}`)), "me@ody.app");
  // 배포 백엔드가 실제로 주는 모양 (2026-09-18 실측)
  assert.equal(emailFromToken(req(`Bearer ${jwt({ sub: "ody-fe-probe@example.com", jti: "x", iat: 1, exp: 2 })}`)), "ody-fe-probe@example.com");
});

test("토큰이 없거나 망가졌으면 null 이다 — 아무나 남의 정보를 물어보지 못한다", () => {
  assert.equal(emailFromToken(req(null)), null);
  assert.equal(emailFromToken(req("Bearer not-a-jwt")), null);
  assert.equal(emailFromToken(req("Bearer header..sig")), null);
  // sub 가 문자열이 아니면 안 쓴다 — 그대로 URL 에 넣으면 엉뚱한 조회가 된다
  assert.equal(emailFromToken(req(`Bearer ${jwt({ sub: { email: "x@y.z" } })}`)), null);
  assert.equal(emailFromToken(req(`Bearer ${jwt({ tokenType: "access" })}`)), null);
});

const detail = (over = {}) => ({
  email: "me@ody.app",
  name: "오디",
  nickname: "우주탐험가",
  isPublic: true,
  tutorialCompleted: false,
  lastActiveAt: null,
  createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  imageUrl: null,
  followerCnt: 12,
  followingCnt: 3,
  isFollowing: false,
  isMe: true,
  ...over,
});

test("백엔드가 준 값은 그대로 옮긴다", () => {
  const p = toUserProfile(detail());
  assert.equal(p.nickname, "우주탐험가");
  assert.equal(p.followerCount, 12);
  assert.equal(p.followingCount, 3);
  // 응답에 없는 필드다 — 비슷한 값으로 대신 채우지 않는다
  assert.equal(toUser(detail()).updatedAt, null);
});

test("가입 N일째는 당일이 1일째다", () => {
  assert.equal(toUserProfile(detail({ createdAt: new Date().toISOString() })).daysSinceJoined, 1);
  assert.equal(toUserProfile(detail()).daysSinceJoined, 4);
  // 날짜가 깨져 와도 화면에 NaN 을 띄우지 않는다
  assert.equal(toUserProfile(detail({ createdAt: "어제" })).daysSinceJoined, 1);
});

/**
 * **서버가 준 값을 그대로 쓴다** (3차 계약 §4, S15P21A405-545).
 *
 * 예전에는 `lastActiveAt` 이 5분 안이면 접속 중으로 봤다. 백엔드에 플래그가 없어서 가늠한
 * 값이었는데, `lastActiveAt` 은 **로그인 시각**이라 애초에 다른 것을 재고 있었다 — 방금
 * 로그인하고 창을 닫은 사람이 계속 접속 중으로 보였다.
 */
test("접속 중 여부는 서버가 준 isOnline 을 그대로 쓴다", () => {
  assert.equal(toUserProfile(detail({ isOnline: true })).isOnline, true);
  assert.equal(toUserProfile(detail({ isOnline: false })).isOnline, false);
});

test("로그인 시각으로 접속 여부를 가늠하지 않는다", () => {
  // 방금 로그인했어도 소켓이 없으면 접속 중이 아니다 — 예전 규칙이면 true 였다
  assert.equal(toUserProfile(detail({ lastActiveAt: new Date().toISOString(), isOnline: false })).isOnline, false);
  // 오래 전에 로그인했어도 소켓이 살아 있으면 접속 중이다
  assert.equal(toUserProfile(detail({ lastActiveAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), isOnline: true })).isOnline, true);
});

test("필드가 없는 배포를 만나면 접속 중이 아니다", () => {
  // 모르는 것을 켜진 것으로 보이면 따라가기 버튼이 열리고, 눌러도 아무 일이 없다
  assert.equal(toUserProfile(detail({ lastActiveAt: new Date().toISOString() })).isOnline, false);
});

test("백엔드에 없는 것은 목으로 채우지 않는다 (A-35)", () => {
  const p = toUserProfile(detail());
  assert.equal(p.nowPlaying, null);
  assert.equal(p.meetingCount, null);
  assert.equal(p.followingTarget, null);
  /**
   * 0 이 아니라 null 이다 (S15P21A405-531). 예전에는 0 을 넣었는데, 그것도 목이다 —
   * "한 곡도 안 들었다" 는 없는 사실을 화면에 적는 셈이었다. 모르면 모른다고 두고 화면이 가린다.
   */
  assert.deepEqual(p.dashboard, { exploredCount: null, discoveredCount: null, moodPreference: [] });
});

test("재생한 곡 수는 백엔드가 주면 그대로 쓴다 (S15P21A405-531)", () => {
  assert.equal(toUserProfile(detail({ playedMusicCnt: 137 })).dashboard.exploredCount, 137);
  // 0 곡도 진짜 0 이면 보여 준다 — 가려야 하는 것은 "모름" 이지 "없음" 이 아니다
  assert.equal(toUserProfile(detail({ playedMusicCnt: 0 })).dashboard.exploredCount, 0);
});
