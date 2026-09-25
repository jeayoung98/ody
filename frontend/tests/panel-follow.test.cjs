/* eslint-disable @typescript-eslint/no-require-imports */
// 재생이 넘어갈 때 곡 상세 패널이 따라갈지 (S15P21A405-656). 직전 재생 곡을 보고 있었을 때만 따라간다 —
// 일부러 열어 둔 다른 곡의 상세까지 바꾸면 사용자가 보던 것이 눈앞에서 사라진다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { panelFollowTarget } = require("../src/lib/panel-follow.ts");

test("직전 재생 곡의 상세를 보고 있었으면 새 곡으로 따라간다", () => {
  assert.equal(panelFollowTarget({ activePanel: "song", musicId: 10 }, 10, 11), 11);
});

test("다른 곡을 열어 뒀거나 곡 상세가 아니면 건드리지 않는다", () => {
  assert.equal(panelFollowTarget({ activePanel: "song", musicId: 99 }, 10, 11), null, "일부러 연 다른 곡");
  assert.equal(panelFollowTarget({ activePanel: "playlist", musicId: 10 }, 10, 11), null, "곡 상세가 아니다");
  assert.equal(panelFollowTarget({ activePanel: null, musicId: 10 }, 10, 11), null, "닫혀 있다");
});

test("재생이 시작·정지되거나 같은 곡이면 따라갈 것이 없다", () => {
  assert.equal(panelFollowTarget({ activePanel: "song", musicId: 10 }, null, 11), null, "처음 재생");
  assert.equal(panelFollowTarget({ activePanel: "song", musicId: 10 }, 10, null), null, "정지");
  assert.equal(panelFollowTarget({ activePanel: "song", musicId: 10 }, 10, 10), null, "같은 곡 다시");
});
