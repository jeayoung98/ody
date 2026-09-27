/* eslint-disable @typescript-eslint/no-require-imports */
// 플레이어바 덮개 농도 — 밝은 커버일수록 진하게 (S15P21A405-704). 흰 커버에서 회색 글자가 묻혔다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { COVER_SHADE, shadeForLuma } = require("../src/lib/cover-shade.ts");

test("까만 커버는 가장 옅게, 흰 커버는 가장 진하게", () => {
  assert.equal(shadeForLuma(0), COVER_SHADE.min);
  assert.equal(shadeForLuma(1), COVER_SHADE.max);
});

test("밝을수록 진해진다", () => {
  assert.ok(shadeForLuma(0.3) < shadeForLuma(0.7));
});

test("범위 밖이나 NaN 은 끝에 붙인다", () => {
  assert.equal(shadeForLuma(-1), COVER_SHADE.min);
  assert.equal(shadeForLuma(2), COVER_SHADE.max);
  assert.equal(shadeForLuma(Number.NaN), COVER_SHADE.min);
});
