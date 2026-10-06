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

test("동명 곡이 많은 제목(BAD)은 아티스트가 맞는 곡만 — 한글·영문 표기 어느 쪽이든", () => {
  const items = [
    { id: 11, title: "Bad", artist: "Michael Jackson" },
    { id: 12, title: "BAD", artist: "Someone Else" },
    { id: 13, title: "BAD", artist: "ATEEZ" },
  ];
  const want = DEMO_SONGS.find((s) => s.title === "BAD");
  assert.ok(want, "목록에 BAD 가 있다");
  assert.equal(matchDemoSong(want, items)?.id, 13);
  assert.equal(matchDemoSong(want, [{ id: 14, title: "Bad", artist: "에이티즈" }])?.id, 14);
  // 아티스트가 하나도 안 맞고 후보가 여럿이면 엉뚱한 Bad 를 집지 않는다
  assert.equal(matchDemoSong(want, items.slice(0, 2)), null);
});

test("ELEVEN 은 아이브/IVE 어느 표기로도 잡힌다", () => {
  const want = DEMO_SONGS.find((s) => s.title === "ELEVEN");
  assert.ok(want);
  assert.equal(matchDemoSong(want, [{ id: 21, title: "Eleven", artist: "IVE (아이브)" }])?.id, 21);
});

test("아티스트는 낱말로 맞춘다 — IVE 가 Ancient River 의 r-ive-r 에 걸리지 않는다 (시연에서 실제로 났던 것)", () => {
  const want = { title: "ELEVEN", artist: ["아이브", "IVE"] };
  const items = [
    { id: 31, title: "ELEVEN", artist: "Ancient River" },
    { id: 32, title: "ELEVEN", artist: "IVE" },
  ];
  assert.equal(matchDemoSong(want, items)?.id, 32, "앞에 있는 Ancient River 곡을 집으면 안 된다");
  // 괄호·빈칸은 경계다 — 표기가 섞여도 잡힌다
  assert.equal(matchDemoSong(want, [{ id: 33, title: "ELEVEN", artist: "IVE (아이브)" }])?.id, 33);
  assert.equal(matchDemoSong({ title: "REDRED", artist: "CORTIS" }, [{ id: 34, title: "REDRED", artist: "CORTIS(코르티스)" }])?.id, 34);
});

test("ELEVEN 은 id 로 고정한다 — 검색하지 않으니 동명 곡으로 샐 수 없다", () => {
  const eleven = DEMO_SONGS.find((s) => s.title === "ELEVEN");
  assert.equal(eleven?.id, 10000940);
});

test("시연 곡 목록은 제목이 비어 있지 않다", () => {
  assert.ok(DEMO_SONGS.length >= 1);
  for (const s of DEMO_SONGS) assert.ok(s.title.trim().length > 0);
});
