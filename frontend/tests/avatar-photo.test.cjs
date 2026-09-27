/* eslint-disable @typescript-eslint/no-require-imports */
// 캔버스용 사진 다시 받기 주소 (S15P21A405-676, troubleshooting 016)
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { withFreshQuery } = require("../src/lib/avatar-photo.ts");

test("캐시를 비키는 쿼리 — 쿼리가 없으면 ? 로, 있으면 & 로 붙인다", () => {
  assert.equal(withFreshQuery("https://j15a405.p.ssafy.io/api/user/images/a.jpg"), "https://j15a405.p.ssafy.io/api/user/images/a.jpg?cors=1");
  assert.equal(withFreshQuery("https://lh3.googleusercontent.com/a/x=s96-c"), "https://lh3.googleusercontent.com/a/x=s96-c?cors=1");
  assert.equal(withFreshQuery("https://h/i.png?v=2"), "https://h/i.png?v=2&cors=1");
});
