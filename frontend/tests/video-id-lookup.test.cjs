/* eslint-disable @typescript-eslint/no-require-imports */
// 백엔드 답 한 줄을 어떻게 읽는지 (S15P21A405-556).
//
// 이건 **백엔드와의 계약**이다. 말로만 두면 다음에 또 뒤집힌다 — 실제로 한 번 뒤집혔다.
// 재생 불가 곡을 DB 에서 지우기로 하면서(S15P21A405-534) `items` 에서 줄이 통째로 빠지게
// 됐는데, 그때까지 그 경우를 "아직 안 찾아봤음" 으로 읽고 있었다. 그러면 없는 곡에
// "잠시 후 다시 눌러 주세요" 가 영원히 뜨고 누를 때마다 재조회가 나간다.
//
// 가르는 기준은 **다시 물을 값이 있는가** 하나다. `unsearched` 만 있고, 나머지는 없다.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { videoIdLookup } = require("../src/app/bff/music/[id]/video-id/route.ts");

test("줄이 아예 없으면 그 곡이 없는 것이다 — 삭제된 곡", () => {
  assert.equal(videoIdLookup(undefined), "notFound");
  assert.equal(videoIdLookup(null), "notFound");
});

test('"none" 은 찾아봤는데 없었다는 뜻이다', () => {
  assert.equal(videoIdLookup({ videoId: "none" }), "notFound");
});

test("빈 문자열도 같게 본다 — 검색 결과가 비었다", () => {
  assert.equal(videoIdLookup({ videoId: "" }), "notFound");
});

test("null 은 **아직 안 찾아봤다** — 여기만 다시 물을 값이 있다", () => {
  assert.equal(videoIdLookup({ videoId: null }), "unsearched");
});

test("값이 있으면 있는 것이다", () => {
  assert.equal(videoIdLookup({ videoId: "PWVy0cYS-9Q" }), "found");
});

/*
 * 없는 곡과 아직 안 찾아본 곡이 **같은 답으로 뭉개지면 안 된다.** 뭉개면 둘 중 하나가
 * 반드시 틀린 대접을 받는다 — 없는 곡을 계속 다시 묻거나, 아직 안 찾아본 곡을 포기하거나.
 */
test("없는 곡과 아직 모르는 곡은 서로 다른 답이다", () => {
  assert.notEqual(videoIdLookup(undefined), videoIdLookup({ videoId: null }));
});
