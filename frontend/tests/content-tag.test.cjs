/* eslint-disable @typescript-eslint/no-require-imports */
// 지도 목록이 바뀌었는지 가르는 태그 (S15P21A405-680). 틀리면 바뀐 목록을 "그대로" 라고 답해 옛 우주를 보여 주거나,
// 그대로인 목록을 매번 1,576KB 다시 보낸다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contentTag, matchesTag } = require("../src/lib/content-tag.ts");

const song = (musicId, over = {}) => ({ musicId, pc: [0.1, -2.345, 3], title: `곡${musicId}`, playable: true, ...over });
const list = [song(3), song(1), song(2)];

test("같은 목록이면 순서가 달라도 같은 태그다 — 백엔드 1겹 조회에는 정렬이 없다", () => {
  assert.equal(contentTag(list), contentTag([song(1), song(2), song(3)]));
  assert.equal(contentTag(list), contentTag([...list].reverse()));
});

test("곡이 하나라도 바뀌면 태그가 바뀐다", () => {
  const base = contentTag(list);
  assert.notEqual(contentTag([song(3), song(1), song(4)]), base, "곡이 바뀜");
  assert.notEqual(contentTag([song(3), song(1)]), base, "곡이 빠짐");
  assert.notEqual(contentTag([song(3), song(1), song(2, { pc: [0.1, -2.345, 3.001] })]), base, "좌표가 바뀜");
  assert.notEqual(contentTag([song(3), song(1), song(2, { playable: false })]), base, "재생 가능 여부가 바뀜");
});

test("태그는 헤더에 그대로 넣을 수 있는 짧은 글자다", () => {
  assert.match(contentTag(list), /^[A-Za-z0-9_-]{22}$/);
});

test("If-None-Match 비교 — W/ 와 따옴표를 떼고 본다", () => {
  const tag = contentTag(list);
  assert.equal(matchesTag(`W/"${tag}"`, tag), true);
  assert.equal(matchesTag(`"${tag}"`, tag), true);
  assert.equal(matchesTag(`W/"다른것", W/"${tag}"`, tag), true);
  assert.equal(matchesTag("*", tag), true);
  assert.equal(matchesTag(`W/"다른것"`, tag), false);
  assert.equal(matchesTag(null, tag), false);
  assert.equal(matchesTag("", tag), false);
});
