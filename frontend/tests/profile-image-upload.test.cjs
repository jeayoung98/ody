/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **프로필 사진 업로드의 신뢰 경계** (S15P21A405-474).
 *
 * 백엔드도 파일을 검사하지만(`UNSUPPORTED_FILE_TYPE`·`FILE_TOO_LARGE`), 거기까지 갔다 오면
 * 사진을 통째로 올린 뒤에야 "안 된다" 를 듣는다. 그리고 업로드는 한 번 통과하면 남의 계정
 * 이미지로 저장되는 종류라, 무엇을 통과시키는지 여기서 못을 박아 둔다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { PATCH } = require("../src/app/bff/user/image/route.ts");

/** 업스트림을 부르면 테스트가 배포 서버를 치게 된다 — 검사를 통과했는지만 보면 되므로 막는다 */
let upstreamCalls = 0;
globalThis.fetch = async () => {
  upstreamCalls += 1;
  throw new TypeError("업스트림은 이 테스트에서 부르지 않는다");
};

const upload = (file) => {
  const form = new FormData();
  if (file) form.append("file", file, file.name);
  return new Request("http://localhost/bff/user/image", { method: "PATCH", body: form });
};
const imageOf = (bytes, type = "image/png", name = "me.png") => new File([new Uint8Array(bytes)], name, { type });
const codeOf = async (res) => (await res.json()).error?.code;

test("이미지가 아니면 올리지 않는다", async () => {
  upstreamCalls = 0;
  const res = await PATCH(upload(imageOf(10, "application/pdf", "resume.pdf")));
  assert.equal(res.status, 400);
  assert.equal(await codeOf(res), "UNSUPPORTED_FILE_TYPE");
  assert.equal(upstreamCalls, 0, "검사에서 막혔으면 백엔드까지 가지 않는다");
});

test("5MB 를 넘으면 올리지 않는다", async () => {
  upstreamCalls = 0;
  const res = await PATCH(upload(imageOf(5 * 1024 * 1024 + 1)));
  assert.equal(res.status, 400);
  assert.equal(await codeOf(res), "FILE_TOO_LARGE");
  assert.equal(upstreamCalls, 0);
});

test("파일이 없거나 비어 있으면 고르라고 답한다", async () => {
  assert.equal(await codeOf(await PATCH(upload(null))), "VALIDATION_ERROR");
  assert.equal(await codeOf(await PATCH(upload(imageOf(0)))), "VALIDATION_ERROR");
});

test("경계값은 통과시킨다 — 정확히 5MB 인 이미지는 막지 않는다", async () => {
  upstreamCalls = 0;
  await PATCH(upload(imageOf(5 * 1024 * 1024)));
  // 검사를 지나 업스트림까지 갔다는 것이 통과의 증거다 (호출은 위에서 막아 뒀다)
  assert.equal(upstreamCalls, 1);
});
