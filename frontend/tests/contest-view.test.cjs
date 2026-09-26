/* eslint-disable @typescript-eslint/no-require-imports */
// 콘테스트 응답을 화면이 무엇으로 읽는가 (S15P21A405-640). 백엔드 회차에는 상태가 없고 기간만 있어서 열림/마감을
// 화면이 판단하고, 리더보드는 순위순 하나만 와서 갤러리 정렬은 화면이 한다 — 그 둘이 틀리면 마감된 회차에 출품
// 버튼이 열려 있거나 "최신순" 이 순위순으로 보인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { roundPhase, sortEntries, ownerLabel, awaitingScore, myEntry, templateScore } = require("../src/lib/contest-view.ts");

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

/**
 * 백엔드가 `ownerNickname` 을 주기 시작했다 (S15P21A405-645). 이메일 앞부분은 **대비책으로만**
 * 남는다 — 사람 이름도 아니고 남에게 이메일 일부를 흘리는 것이기도 했다.
 */
test("주인은 닉네임으로 적는다", () => {
  assert.equal(ownerLabel("luna@ody.app", "루나"), "루나");
  assert.equal(ownerLabel(null, "루나"), "루나", "이메일이 없어도 닉네임이 있으면 그것이 이름이다");
});

test("닉네임이 없으면 이메일 앞부분, 그것도 없으면 익명", () => {
  assert.equal(ownerLabel("luna@ody.app", null), "luna", "탈퇴 등으로 user 행이 없으면 닉네임이 null 이다");
  assert.equal(ownerLabel("luna@ody.app"), "luna", "닉네임을 안 넘긴 자리도 예전처럼 돈다");
  assert.equal(ownerLabel("luna@ody.app", "   "), "luna", "공백뿐인 닉네임은 이름이 아니다");
  assert.equal(ownerLabel(null, null), "익명");
  assert.equal(ownerLabel("noat"), "noat");
});

test("채점 대기 중인 내 작품이 있을 때만 폴링한다", () => {
  assert.equal(awaitingScore(undefined), false);
  assert.equal(awaitingScore([entry({ status: "SCORED" })]), false);
  assert.equal(awaitingScore([entry({ status: "PENDING" })]), true);
  assert.equal(myEntry([entry({ artworkId: 7 })]).artworkId, 7);
  assert.equal(myEntry([]), null);
});

test("AI 추천 적합도는 그린 별자리와 같은 0~100·등급 척도로 옮긴다", () => {
  assert.deepEqual(templateScore(0), { score: 100, quality: "HIGH" });
  assert.deepEqual(templateScore(0.08), { score: 92, quality: "HIGH" });
  assert.deepEqual(templateScore(0.25), { score: 75, quality: "MEDIUM" });
  assert.deepEqual(templateScore(0.5), { score: 50, quality: "LOW" });
  assert.deepEqual(templateScore(3), { score: 0, quality: "LOW" }, "반폭 넘게 어긋나면 0 으로 누른다");
});

// ── 그리기 탭 단계 (S15P21A405-693) ───────────────────────────────────────────
{
  const { sketchStep } = require("../src/lib/contest-view.ts");
  const entry = (status) => ({ artworkId: 1, rank: null, title: "고양이", ownerEmail: null, ownerNickname: null, status, score: status === "SCORED" ? 83 : null, aiComment: null, failReason: null, likeCnt: 0, likedByMe: false, musicCnt: 5, createdAt: "2026-09-26T00:00:00Z", rankScore: null, closed: true, tracks: [], playlistId: null });
  const match = { score: 90, quality: "HIGH", tracks: [] };

  test("곡을 아직 못 찾았으면 그리기 단계다", () => {
    assert.equal(sketchStep({ viewingMine: false, mine: null, match: null, title: "" }), "draw");
  });

  test("곡을 찾았으면 곡 확인, 이름을 적기 시작하면 출품 단계다", () => {
    assert.equal(sketchStep({ viewingMine: false, mine: null, match, title: "" }), "review");
    assert.equal(sketchStep({ viewingMine: false, mine: null, match, title: "  " }), "review");
    assert.equal(sketchStep({ viewingMine: false, mine: null, match, title: "창가" }), "submit");
  });

  test("내 작품을 보는 중이면 채점 전은 채점 단계, 채점 뒤는 모두 끝(null)이다", () => {
    assert.equal(sketchStep({ viewingMine: true, mine: entry("PENDING"), match: null, title: "" }), "scoring");
    assert.equal(sketchStep({ viewingMine: true, mine: entry("FAILED"), match: null, title: "" }), "scoring");
    assert.equal(sketchStep({ viewingMine: true, mine: entry("SCORED"), match: null, title: "" }), null);
  });

  test("낸 작품이 있어도 새로 그리는 중이면 이전 작품 상태와 상관없이 그리기부터다", () => {
    assert.equal(sketchStep({ viewingMine: false, mine: entry("SCORED"), match: null, title: "" }), "draw");
  });
}
