/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 음악·아티스트 조건 검색 (SEARCH-01 · S15P21A405-399).
 *
 * 전달 문서 §7.2 의 "검색 훅" 검증 항목이다 — 세 유효 조합의 URL, `music` 단독 보류,
 * 조건별 query key. 직렬화가 틀리면 백엔드가 400 을 주는데 화면에서는 그냥 "검색 실패" 로만
 * 보여서, 여기서 잡지 않으면 원인을 찾는 데 오래 걸린다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canSearch, searchRequestPath, flattenSearch } = require("../src/hooks/queries/use-music-search-query.ts");
const { QUERY_KEYS } = require("../src/constants/index.ts");

const params = (path) => Object.fromEntries(new URL(path, "http://x").searchParams);

test("통합 검색은 q 만 보낸다 — query 와 music/artist 를 섞지 않는다", () => {
  assert.deepEqual(params(searchRequestPath({ mode: "all", query: "Love" }, 0)), { q: "Love", page: "0" });
});

test("아티스트 검색은 artist 만 보낸다. 빈 선택 입력은 생략한다", () => {
  assert.deepEqual(params(searchRequestPath({ mode: "artist", artist: "Radiohead", music: "" }, 0)), { artist: "Radiohead", page: "0" });
});

test("아티스트 안에서 음악을 좁히면 둘 다 보낸다", () => {
  assert.deepEqual(params(searchRequestPath({ mode: "artist", artist: "Radiohead", music: "Creep" }, 0)), {
    artist: "Radiohead",
    music: "Creep",
    page: "0",
  });
});

test("음악을 아티스트로 좁히면 music 과 artist 를 함께 보낸다", () => {
  assert.deepEqual(params(searchRequestPath({ mode: "music", music: "Love", artist: "Lana Del Rey" }, 0)), {
    music: "Love",
    artist: "Lana Del Rey",
    page: "0",
  });
});

test("앞뒤 공백은 검색어가 아니다", () => {
  assert.deepEqual(params(searchRequestPath({ mode: "all", query: "  Love  " }, 2)), { q: "Love", page: "2" });
});

test("music 단독은 요청하지 않는다 — 백엔드가 400 이다", () => {
  assert.equal(canSearch({ mode: "music", music: "Love", artist: "" }), false);
  assert.equal(canSearch({ mode: "music", music: "Love", artist: "Lana" }), true);
});

test("빈 통합 검색어·빈 아티스트는 요청하지 않는다", () => {
  assert.equal(canSearch({ mode: "all", query: "   " }), false);
  assert.equal(canSearch({ mode: "artist", artist: "", music: "Creep" }), false);
  assert.equal(canSearch({ mode: "artist", artist: "Radiohead", music: "" }), true);
});

test("같은 문자열이라도 모드가 다르면 다른 캐시다 — 이전 조건 결과가 남으면 안 된다", () => {
  const all = QUERY_KEYS.music.search({ mode: "all", query: "Love" });
  const artist = QUERY_KEYS.music.search({ mode: "artist", artist: "Love", music: "" });
  const music = QUERY_KEYS.music.search({ mode: "music", music: "Love", artist: "" });
  assert.notDeepEqual(all, artist);
  assert.notDeepEqual(all, music);
  assert.notDeepEqual(artist, music);
});

test("같은 조건이면 같은 키다", () => {
  assert.deepEqual(QUERY_KEYS.music.search({ mode: "artist", artist: "Radiohead", music: "Creep" }), QUERY_KEYS.music.search({ mode: "artist", artist: "Radiohead", music: "Creep" }));
});

test("페이지를 이어 붙일 때 같은 음악이 두 번 뜨지 않는다", () => {
  const pages = [
    { items: [{ id: 1, title: "a", artist: null }, { id: 2, title: "b", artist: null }], page: 0, hasNext: true },
    { items: [{ id: 2, title: "b", artist: null }, { id: 3, title: "c", artist: null }], page: 1, hasNext: false },
  ];
  assert.deepEqual(flattenSearch(pages).map((r) => r.id), [1, 2, 3]);
});

test("받아 둔 페이지가 없으면 빈 목록이다", () => {
  assert.deepEqual(flattenSearch(undefined), []);
});

/**
 * 목 검색 (전달 문서 §10 — "프론트는 실제 연동 전에 목 라우트도 같은 요청·페이지 응답 형태로 맞춘다").
 * 배포 백엔드가 `artist`/`music` 을 아직 안 받아서, 세 경로를 지금 굴려 볼 수 있는 곳은 목뿐이다.
 */
const { mockSearch } = require("../src/mocks/music.ts");

const titles = (rows) => rows.map((r) => r.title);

test("목도 앞일치다 — 부분일치로 두면 목에서만 나오는 결과가 생긴다", () => {
  const hit = mockSearch({ q: "a", artist: "", music: "" });
  assert.ok(hit.every((r) => r.title.toLowerCase().startsWith("a") || (r.artist ?? "").toLowerCase().startsWith("a")));
});

test("통합 검색은 제목 또는 아티스트에서 찾는다", () => {
  const rows = mockSearch({ q: "the", artist: "", music: "" });
  assert.ok(rows.every((r) => r.title.toLowerCase().startsWith("the") || (r.artist ?? "").toLowerCase().startsWith("the")));
});

test("아티스트 조건은 아티스트에만 건다", () => {
  const any = mockSearch({ q: "", artist: "a", music: "" });
  assert.ok(any.every((r) => (r.artist ?? "").toLowerCase().startsWith("a")));
});

test("아티스트 + 음악은 둘 다 만족해야 한다", () => {
  const both = mockSearch({ q: "", artist: "a", music: "s" });
  assert.ok(both.every((r) => (r.artist ?? "").toLowerCase().startsWith("a") && r.title.toLowerCase().startsWith("s")));
  // 좁힌 결과는 아티스트만 건 결과의 부분집합이다
  const wide = new Set(titles(mockSearch({ q: "", artist: "a", music: "" })));
  assert.ok(titles(both).every((t) => wide.has(t)));
});

test("조건이 하나도 없으면 아무것도 안 준다", () => {
  assert.deepEqual(mockSearch({ q: "", artist: "", music: "" }), []);
});
