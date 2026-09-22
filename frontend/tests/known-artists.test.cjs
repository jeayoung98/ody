/* eslint-disable @typescript-eslint/no-require-imports */
// 봇이 "아는 가수" 를 알아보는가 (S15P21A405-543).
// 카탈로그가 가수 이름을 한글로 들고 있는지 로마자로 들고 있는지 확인하지 못했다
// (배포 API 가 인증을 요구한다). 어느 쪽이 와도 걸리는지를 여기서 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { artistParts, isKnownArtist, normalizeArtist } = require("../src/lib/bots/known-artists.ts");

test("한글로 와도 로마자로 와도 같은 가수로 본다", () => {
  for (const [ko, en] of [
    ["아이유", "IU"],
    ["방탄소년단", "BTS"],
    ["뉴진스", "NewJeans"],
    ["악동뮤지션", "AKMU"],
  ]) {
    assert.ok(isKnownArtist(ko), ko);
    assert.ok(isKnownArtist(en), en);
  }
});

test("표기 흔들림을 견딘다 — 대소문자·공백·기호", () => {
  assert.ok(isKnownArtist("iu"));
  assert.ok(isKnownArtist("  I.U.  "), "점과 공백이 섞여도 같은 이름이다");
  assert.ok(isKnownArtist("new jeans"));
  assert.ok(isKnownArtist("Girls Generation"), "따옴표가 빠진 표기");
  assert.ok(isKnownArtist("(여자)아이들"), "괄호가 든 이름");
  assert.equal(normalizeArtist("Zion.T"), "ziont");
});

test("여럿이 한 칸에 들어와도 각각 본다", () => {
  assert.deepEqual(artistParts("IU feat. SUGA"), ["iu", "suga"]);
  assert.ok(isKnownArtist("IU feat. SUGA"));
  assert.ok(isKnownArtist("아이유, 박효신"));
  assert.ok(isKnownArtist("Crush X Zion.T"));
  assert.ok(isKnownArtist("Some Nobody & 태연"), "뒤에 붙어 있어도 찾는다");
});

/**
 * **부분 일치로 두면 안 된다.** `IU` 는 두 글자라 아무 이름에나 들어 있다 — 그걸로 걸러 두면
 * 봇이 아이유 곡을 듣는다며 엉뚱한 곡에 서 있게 된다. 잘라서 **정확히** 견주는 이유다.
 */
test("이름이 겹쳐 보이는 남을 아는 가수로 착각하지 않는다", () => {
  assert.ok(!isKnownArtist("Iuliana Beregoi"), "IU 로 시작할 뿐 다른 사람이다");
  assert.ok(!isKnownArtist("BTSX Project"));
  assert.ok(!isKnownArtist("아이유니콘"));
  assert.ok(!isKnownArtist("Rainbow"), "Rain 이 들어 있을 뿐이다");
});

test("가수가 없는 곡은 아는 곡이 아니다", () => {
  assert.ok(!isKnownArtist(null));
  assert.ok(!isKnownArtist(undefined));
  assert.ok(!isKnownArtist(""));
  assert.ok(!isKnownArtist("   "));
});

test("아는 가수가 아니면 그냥 아니다 — 모르는 이름에 관대하지 않다", () => {
  assert.ok(!isKnownArtist("The Mountain Goats"));
  assert.ok(!isKnownArtist("Various Artists"));
});
