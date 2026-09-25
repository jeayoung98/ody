/* eslint-disable @typescript-eslint/no-require-imports */
// 지도 응답 gzip (S15P21A405-680). 실제 헬퍼를 node 에서 그대로 부른다 — 헤더가 빠지면 브라우저가 압축본을 JSON 으로
// 읽으려다 지도가 안 뜨고, 실데이터 표시(x-ody-*)가 빠지면 개발 빌드 콘솔에서 목과 실데이터를 못 가른다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { gunzipSync } = require("node:zlib");
const { okLiveGzip } = require("../src/lib/gzip-json.ts");
const { LIVE_HEADERS } = require("../src/lib/api-response.ts");

const data = Array.from({ length: 300 }, (_, i) => ({ musicId: i, pc: new Array(16).fill(0.123), title: "같은 제목", playable: true }));
const req = (encoding) => new Request("http://localhost/bff/map/songs?level=1", { headers: encoding ? { "accept-encoding": encoding } : {} });

test("gzip 을 받는 요청에는 압축해서 보내고, 풀면 봉투 그대로다", async () => {
  const res = await okLiveGzip(req("gzip, deflate, br"), data, "/api/music/major?level=1");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), "gzip");
  assert.equal(res.headers.get("vary"), "Accept-Encoding");
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const raw = Buffer.from(await res.arrayBuffer());
  const body = JSON.parse(gunzipSync(raw).toString("utf8"));
  assert.deepEqual(body, { success: true, data, error: null });
  assert.ok(raw.length < JSON.stringify(body).length / 3, `압축본 ${raw.length}B 가 원본의 1/3 보다 작아야 한다`);
});

test("gzip 을 못 받으면 원본 JSON 을 그대로 보낸다", async () => {
  const res = await okLiveGzip(req(null), data, "/api/music/major?level=1");
  assert.equal(res.headers.get("content-encoding"), null);
  assert.deepEqual(await res.json(), { success: true, data, error: null });
});

test("압축 여부와 상관없이 실데이터 표시를 단다 — 브라우저 통로가 이걸 보고 콘솔에 찍는다", async () => {
  for (const encoding of ["gzip", null]) {
    const res = await okLiveGzip(req(encoding), data, "/api/music/major?level=2&pc1min=0");
    assert.equal(res.headers.get(LIVE_HEADERS.source), "live");
    assert.equal(res.headers.get(LIVE_HEADERS.upstream), "/api/music/major?level=2&pc1min=0");
  }
});
