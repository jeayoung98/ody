/* eslint-disable @typescript-eslint/no-require-imports */
// 콘테스트 응답을 화면이 무엇으로 읽는가 (S15P21A405-640). 백엔드 회차에는 상태가 없고 기간만 있어서 열림/마감을
// 화면이 판단하고, 리더보드는 순위순 하나만 와서 갤러리 정렬은 화면이 한다 — 그 둘이 틀리면 마감된 회차에 출품
// 버튼이 열려 있거나 "최신순" 이 순위순으로 보인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { roundPhase, sortEntries, ownerLabel, awaitingScore, myEntry } = require("../src/lib/contest-view.ts");

const round = { startsAt: "2026-09-20T00:00:00+09:00", endsAt: "2026-09-27T00:00:00+09:00" };
const at = (iso) => new Date(iso).getTime();

test("기간 안이면 열림, 시작 전·끝난 뒤는 각각 시작 전·마감", () => {
  assert.equal(roundPhase(round, at("2026-09-23T12:00:00+09:00")), "OPEN");
  assert.equal(roundPhase(round, at("2026-09-19T23:59:59+09:00")), "UPCOMING");
  assert.equal(roundPhase(round, at("2026-09-27T00:00:00+09:00")), "CLOSED", "endsAt 그 시각은 이미 마감이다");
});

const entry = (over) => ({
  artworkId: 1, rank: null, title: "t", ownerEmail: "a@b.c", status: "SCORED", score: 50, aiComment: null, failReason: null,
  likeCnt: 0, likedByMe: false, musicCnt: 5, createdAt: "2026-09-23T10:00:00+09:00", rankScore: null, closed: false, tracks: [], ...over,
});

test("정렬은 원본을 건드리지 않고, 순위순은 rank 없는 것을 뒤로 보낸다", () => {
  const items = [entry({ artworkId: 1, rank: 2, likeCnt: 1, score: 90, createdAt: "2026-09-23T10:00:00+09:00" }), entry({ artworkId: 2, rank: 1, likeCnt: 5, score: 40, createdAt: "2026-09-23T09:00:00+09:00" }), entry({ artworkId: 3, rank: null, likeCnt: 9, score: null, createdAt: "2026-09-23T11:00:00+09:00" })];
  assert.deepEqual(sortEntries(items, "rank").map((e) => e.artworkId), [2, 1, 3]);
  assert.deepEqual(sortEntries(items, "latest").map((e) => e.artworkId), [3, 1, 2]);
  assert.deepEqual(sortEntries(items, "likes").map((e) => e.artworkId), [3, 2, 1]);
  assert.deepEqual(sortEntries(items, "ai").map((e) => e.artworkId), [1, 2, 3], "점수 없는 것은 맨 뒤");
  assert.equal(items[0].artworkId, 1, "원본 순서 그대로");
});

test("주인은 이메일 앞부분, 없으면 익명", () => {
  assert.equal(ownerLabel("luna@ody.app"), "luna");
  assert.equal(ownerLabel(null), "익명");
  assert.equal(ownerLabel("noat"), "noat");
});

test("채점 대기 중인 내 작품이 있을 때만 폴링한다", () => {
  assert.equal(awaitingScore(undefined), false);
  assert.equal(awaitingScore([entry({ status: "SCORED" })]), false);
  assert.equal(awaitingScore([entry({ status: "PENDING" })]), true);
  assert.equal(myEntry([entry({ artworkId: 7 })]).artworkId, 7);
  assert.equal(myEntry([]), null);
});
