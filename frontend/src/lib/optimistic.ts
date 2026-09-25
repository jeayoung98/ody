import type { ContestLeaderboard, Contest, PlaylistDetail, PlaylistItemWithMusic, PlaylistSummary, UserProfile, FollowListResponse, Music } from "@/types";

/**
 * 낙관적 업데이트가 캐시에 적용하는 **순수 계산** (S15P21A405-675).
 *
 * 뮤테이션 훅은 "어느 키를" 만지는지만 알고, "어떻게" 바뀌는지는 여기 있다 — 그래야 React 없이 테스트할 수
 * 있고(`tests/optimistic.test.cjs`), 같은 모양의 계산(좋아요 수 ±1)이 훅마다 다르게 굳지 않는다.
 * 모두 `undefined` 를 그대로 돌려준다: 캐시에 없는 쿼리는 만들지 않는다.
 */

/** 구독 상태·수. 상대 프로필은 팔로워 수, 내 프로필은 팔로잉 수가 움직인다 */
export function withFollow(profile: UserProfile | undefined, follow: boolean, role: "target" | "me"): UserProfile | undefined {
  if (!profile) return profile;
  const delta = follow ? 1 : -1;
  if (role === "me") return { ...profile, followingCount: Math.max(0, profile.followingCount + delta) };
  // 이미 그 상태면 수를 또 움직이지 않는다 — 연타·재시도가 수를 두 번 세지 않게
  if (profile.isFollowing === follow) return profile;
  return { ...profile, isFollowing: follow, followerCount: Math.max(0, profile.followerCount + delta) };
}

/** 팔로워·팔로잉 목록의 줄마다 있는 `isFollowing` 은 **보는 사람 기준**이라 어느 목록이든 같은 사람은 같이 바뀐다 */
export function withFollowInList(list: FollowListResponse | undefined, email: string, follow: boolean): FollowListResponse | undefined {
  if (!list) return list;
  return { ...list, content: list.content.map((u) => (u.email === email ? { ...u, isFollowing: follow } : u)) };
}

export function withPlaylistLike(detail: PlaylistDetail | undefined, liked: boolean): PlaylistDetail | undefined {
  if (!detail || detail.isLiked === liked) return detail;
  return { ...detail, isLiked: liked, likeCnt: Math.max(0, (detail.likeCnt ?? 0) + (liked ? 1 : -1)) };
}

/** 좋아요한 플리 목록 — 거두면 빠지고, 누르면 상세에서 만든 요약이 맨 앞에 선다 */
export function withLikedPlaylist(list: PlaylistSummary[] | undefined, playlist: PlaylistDetail | undefined, playlistId: number, liked: boolean): PlaylistSummary[] | undefined {
  if (!list) return list;
  const rest = list.filter((p) => p.id !== playlistId);
  if (!liked) return rest;
  if (!playlist) return list;
  return [summaryOf(playlist), ...rest];
}

export function summaryOf(p: PlaylistDetail): PlaylistSummary {
  return { id: p.id, playlistName: p.playlistName, likeCnt: p.likeCnt, itemCount: p.itemCount, ownerNickname: p.ownerNickname };
}

/** 출품작 표 주기·거두기. 남은 표(`myVotesLeft`)는 회차에 있어 목록 안의 회차도 같이 움직인다 */
export function withEntryLike(board: ContestLeaderboard | undefined, artworkId: number, liked: boolean): ContestLeaderboard | undefined {
  if (!board) return board;
  const target = board.items.find((e) => e.artworkId === artworkId);
  if (!target || target.likedByMe === liked) return board;
  return {
    ...board,
    round: withVotesLeft(board.round, liked)!,
    items: board.items.map((e) => (e.artworkId === artworkId ? { ...e, likedByMe: liked, likeCnt: Math.max(0, e.likeCnt + (liked ? 1 : -1)) } : e)),
  };
}

export function withVotesLeft(round: Contest | null | undefined, liked: boolean): Contest | null | undefined {
  if (!round || round.myVotesLeft == null) return round;
  return { ...round, myVotesLeft: Math.max(0, round.myVotesLeft + (liked ? -1 : 1)) };
}

export function withoutPlaylistItem(detail: PlaylistDetail | undefined, musicId: number): PlaylistDetail | undefined {
  if (!detail) return detail;
  const items = detail.items.filter((it) => it.musicId !== musicId);
  if (items.length === detail.items.length) return detail;
  return { ...detail, items, itemCount: Math.max(0, detail.itemCount - 1) };
}

/** 곡을 뒤에 붙인다. 이미 있으면 그대로 — 서버도 그때는 `skippedCnt` 로 거른다 */
export function withPlaylistItem(detail: PlaylistDetail | undefined, music: Music | undefined): PlaylistDetail | undefined {
  if (!detail || !music) return detail;
  if (detail.items.some((it) => it.musicId === music.id)) return detail;
  const item: PlaylistItemWithMusic = { playlistId: detail.id, musicId: music.id, addedAt: null, music };
  return { ...detail, items: [...detail.items, item], itemCount: detail.itemCount + 1 };
}

/** 플리 요약 목록에서 곡 수만 옮긴다. 목록에 없는 플리면 그대로 */
export function withItemCount(list: PlaylistSummary[] | undefined, playlistId: number, delta: number): PlaylistSummary[] | undefined {
  if (!list) return list;
  return list.map((p) => (p.id === playlistId ? { ...p, itemCount: Math.max(0, p.itemCount + delta) } : p));
}

export function withoutPlaylist(list: PlaylistSummary[] | undefined, playlistId: number): PlaylistSummary[] | undefined {
  if (!list) return list;
  return list.filter((p) => p.id !== playlistId);
}
