/* eslint-disable @typescript-eslint/no-require-imports */
// 시연 곡을 검색 결과에서 고르는 규칙 (S15P21A405-717).
// id 를 모르고 제목·아티스트로 찾으므로, 동명 곡·표기 흔들림에서 엉뚱한 곡을 집지 않는지 묶어 둔다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchDemoSong, DEMO_SONGS } = require("../src/constants/demo-pins.ts");

test("제목이 같고 아티스트가 맞는 곡을 고른다 — 대소문자·공백은 무시", () => {
  const items = [
    { id: 1, title: "Pick Me (Remix)", artist: "Someone" },
    { id: 2, title: "pick me", artist: "Another" },
    { id: 3, title: "PICK  ME ", artist: "Produce 101" },
  ];
  assert.equal(matchDemoSong({ title: "PICK ME", artist: "PRODUCE 101" }, items)?.id, 3);
});

test("아티스트가 여럿 적히면 하나만 맞아도 된다", () => {
  const items = [{ id: 9, title: "REDRED", artist: "CORTIS" }];
  assert.equal(matchDemoSong({ title: "REDRED", artist: ["코르티스", "CORTIS"] }, items)?.id, 9);
});

test("아티스트가 안 맞아도 제목 후보가 하나뿐이면 그 곡, 여럿이면 고르지 않는다", () => {
  const one = [{ id: 4, title: "Plier", artist: "Unknown" }];
  assert.equal(matchDemoSong({ title: "Plier", artist: "Wizzo" }, one)?.id, 4);
  const many = [
    { id: 5, title: "Plier", artist: "A" },
    { id: 6, title: "Plier", artist: "B" },
  ];
  assert.equal(matchDemoSong({ title: "Plier", artist: "Wizzo" }, many), null);
});

test("아티스트가 없는 곡은 제목만 본다. 제목이 없으면 null", () => {
  const items = [{ id: 7, title: "Hollywood Action", artist: null }];
  assert.equal(matchDemoSong({ title: "Hollywood Action" }, items)?.id, 7);
  assert.equal(matchDemoSong({ title: "Hollywood Action" }, [{ id: 8, title: "Hollywood", artist: null }]), null);
});

test("시연 곡 목록은 제목이 비어 있지 않다", () => {
  assert.ok(DEMO_SONGS.length >= 1);
  for (const s of DEMO_SONGS) assert.ok(s.title.trim().length > 0);
});
