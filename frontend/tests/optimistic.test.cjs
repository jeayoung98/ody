/* eslint-disable @typescript-eslint/no-require-imports */
// 낙관적 업데이트의 캐시 계산 (S15P21A405-675). 훅은 "어느 키" 만 알고, 값이 어떻게 바뀌는지는 전부 여기다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const o = require("../src/lib/optimistic.ts");

const profile = { email: "a@ody.kr", nickname: "a", isFollowing: false, followerCount: 3, followingCount: 5 };

test("팔로우: 상대는 isFollowing·팔로워 수, 나는 팔로잉 수만 움직인다", () => {
  assert.deepEqual(o.withFollow(profile, true, "target"), { ...profile, isFollowing: true, followerCount: 4 });
  assert.deepEqual(o.withFollow(profile, true, "me"), { ...profile, followingCount: 6 });
  assert.equal(o.withFollow(undefined, true, "target"), undefined, "캐시에 없는 쿼리는 만들지 않는다");
});

test("팔로우: 이미 그 상태면 수를 또 세지 않는다 (연타·재시도)", () => {
  const followed = o.withFollow(profile, true, "target");
  assert.equal(o.withFollow(followed, true, "target"), followed);
  assert.deepEqual(o.withFollow(followed, false, "target"), { ...profile });
  assert.equal(o.withFollow({ ...profile, followerCount: 0 }, false, "target").followerCount, 0, "0 아래로 안 내려간다");
});

test("팔로우 목록: 그 사람 줄만 바뀐다", () => {
  const list = { type: "follower", content: [{ email: "a@ody.kr", isFollowing: false }, { email: "b@ody.kr", isFollowing: false }], page: 0, size: 20, hasNext: false };
  assert.deepEqual(o.withFollowInList(list, "a@ody.kr", true).content.map((u) => u.isFollowing), [true, false]);
});

const detail = { id: 7, playlistName: "밤", likeCnt: 2, itemCount: 2, ownerNickname: "a", isLiked: false, items: [{ playlistId: 7, musicId: 1, addedAt: null, music: { id: 1 } }, { playlistId: 7, musicId: 2, addedAt: null, music: { id: 2 } }] };

test("플리 좋아요: 하트와 수가 같이 뒤집히고, 같은 상태면 그대로", () => {
  const liked = o.withPlaylistLike(detail, true);
  assert.equal(liked.isLiked, true);
  assert.equal(liked.likeCnt, 3);
  assert.equal(o.withPlaylistLike(liked, true), liked);
  assert.equal(o.withPlaylistLike({ ...detail, likeCnt: null }, true).likeCnt, 1, "likeCnt null 은 0 으로 본다");
});

test("좋아요한 플리 목록: 거두면 빠지고, 누르면 상세에서 만든 요약이 앞에 선다", () => {
  const list = [{ id: 7, playlistName: "밤", likeCnt: 2, itemCount: 2, ownerNickname: "a" }, { id: 8, playlistName: "낮", likeCnt: 0, itemCount: 1, ownerNickname: "b" }];
  assert.deepEqual(o.withLikedPlaylist(list, detail, 7, false).map((p) => p.id), [8]);
  assert.deepEqual(o.withLikedPlaylist([list[1]], detail, 7, true).map((p) => p.id), [7, 8]);
  assert.equal(o.withLikedPlaylist([list[1]], undefined, 7, true).length, 1, "상세를 모르면 요약을 못 만들어 그대로");
});

test("출품작 표: 하트·표 수·남은 표가 같이 움직인다", () => {
  const board = { round: { roundId: 1, voteLimit: 3, myVotesLeft: 2 }, items: [{ artworkId: 10, likeCnt: 4, likedByMe: false }, { artworkId: 11, likeCnt: 1, likedByMe: true }] };
  const voted = o.withEntryLike(board, 10, true);
  assert.deepEqual(voted.items.map((e) => [e.likedByMe, e.likeCnt]), [[true, 5], [true, 1]]);
  assert.equal(voted.round.myVotesLeft, 1);
  const undone = o.withEntryLike(voted, 11, false);
  assert.equal(undone.items[1].likeCnt, 0);
  assert.equal(undone.round.myVotesLeft, 2);
  assert.equal(o.withEntryLike(board, 99, true), board, "없는 작품이면 그대로");
  assert.equal(o.withVotesLeft({ roundId: 1, myVotesLeft: null }, true).myVotesLeft, null, "남은 표를 모르면(로그인 전) 안 센다");
});

test("플리 곡 빼기·담기: 줄과 곡 수가 같이 움직이고, 중복은 안 움직인다", () => {
  const removed = o.withoutPlaylistItem(detail, 1);
  assert.deepEqual(removed.items.map((it) => it.musicId), [2]);
  assert.equal(removed.itemCount, 1);
  assert.equal(o.withoutPlaylistItem(detail, 99), detail, "없는 곡이면 그대로");
  const added = o.withPlaylistItem(detail, { id: 3, title: "t" });
  assert.deepEqual(added.items.map((it) => it.musicId), [1, 2, 3]);
  assert.equal(added.itemCount, 3);
  assert.equal(o.withPlaylistItem(detail, { id: 2 }), detail, "이미 담긴 곡은 그대로 — 서버도 skippedCnt 로 거른다");
  assert.equal(o.withPlaylistItem(detail, undefined), detail, "곡 정보를 모르면 줄을 못 붙인다");
});

test("플리 요약 목록: 곡 수 ±, 삭제", () => {
  const list = [{ id: 7, itemCount: 2 }, { id: 8, itemCount: 0 }];
  assert.deepEqual(o.withItemCount(list, 7, 1).map((p) => p.itemCount), [3, 0]);
  assert.deepEqual(o.withItemCount(list, 8, -1).map((p) => p.itemCount), [2, 0], "0 아래로 안 내려간다");
  assert.deepEqual(o.withoutPlaylist(list, 7).map((p) => p.id), [8]);
});
