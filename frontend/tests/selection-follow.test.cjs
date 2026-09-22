/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **재생이 옮겨 가면 선택도 따라간다** (S15P21A405-578).
 *
 * 틀려도 오류가 안 난다 — 주변 탐색이 조용히 엉뚱한 곡을 한가운데 놓을 뿐이다.
 * 플리는 비슷한 곡끼리 묶여 있어서 "유사곡이 중앙에 왔다" 로만 보이고, 무엇이 기준이었는지는
 * 화면에 안 적혀 있다. 그래서 눈으로는 못 잡는다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shouldFollowPlayback } = require("../src/components/map/selection-follow.ts");

const base = { playingMusicId: 7, selectedMusicId: 3, restored: false, riding: false };

test("재생이 선택과 다른 곡으로 넘어가면 선택을 데려간다", () => {
  // 플리·여정 순차 재생, 다음·이전 버튼, 곡이 끝나 자동으로 넘어갈 때가 전부 여기다
  assert.equal(shouldFollowPlayback(base), true);
  assert.equal(shouldFollowPlayback({ ...base, selectedMusicId: null }), true, "아무것도 안 골라 둔 상태");
});

test("이미 그 곡이 선택돼 있으면 할 일이 없다", () => {
  // 지도에서 별을 눌러 재생하는 길 — 선택과 재생을 이미 함께 옮긴다
  assert.equal(shouldFollowPlayback({ ...base, selectedMusicId: 7 }), false);
});

/**
 * 따라가는 중에는 인솔자가 **열어 둔 상세 곡**이 선택을 정한다 (SOCIAL-07, S15P21A405-557).
 * 인솔자가 서 있는 곡과 보고 있는 곡은 다를 수 있어서, 재생을 좇으면 우측 패널을 덮어쓴다.
 */
test("따라가는 중에는 재생을 좇지 않는다", () => {
  assert.equal(shouldFollowPlayback({ ...base, riding: true }), false);
});

test("새로고침으로 되살린 곡에는 링을 붙이지 않는다", () => {
  // 지도를 열자마자 아무도 안 누른 선택이 생긴다
  assert.equal(shouldFollowPlayback({ ...base, restored: true }), false);
});

test("재생 중인 곡이 없으면 아무것도 안 한다", () => {
  assert.equal(shouldFollowPlayback({ ...base, playingMusicId: null }), false);
});
