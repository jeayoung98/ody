import { LAYER_COUNT } from "@/constants";
import type { NearbyUser, PlaylistRankingItem, User, UserProfile, UserRankingItem } from "@/types";
import { seeded } from "./seed";
import { allSongs, MOODS, nearestSongs } from "./songs";

export const MOCK_ME_EMAIL = "me@ody.app";

export function mockMe(): User {
  return {
    email: MOCK_ME_EMAIL,
    name: "오디",
    nickname: "우주탐험가",
    isPublic: true,
    tutorialCompleted: false,
    lastActiveAt: new Date().toISOString(),
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    imageUrl: null,
  };
}

const KNAMES = ["연희", "도현", "수아", "지훈", "하람", "세영", "준", "서윤", "민재", "다온", "해린", "우진", "가온", "예린", "시우", "도경", "윤슬", "한결", "보람", "태오"];
const HANDLES = ["minor_chord", "tape_hiss", "nocturne_9", "vinyl_dust", "low_pass", "blue_note", "echo_room", "dust_grain", "slow_verb", "night_bus", "reverb_kid", "tape_loop", "sub_bass", "half_step", "white_room", "dry_signal", "room_tone", "off_beat"];
const PER_LAYER = 12;

const byLayer = new Map<number, NearbyUser[]>();

/**
 * 레이어(영역)별 주변 사용자. 백엔드가 지금 있는 영역의 사람만 내려준다는 전제라 레이어마다 다른 사람이 보인다.
 * 각자 듣고 있는 곡이 지도상 위치가 된다.
 */
export function mockNearbyUsers(layer: number): NearbyUser[] {
  const key = Math.max(0, Math.min(LAYER_COUNT - 1, layer));
  let list = byLayer.get(key);
  if (list) return list;
  const rnd = seeded(7771 + key * 977);
  const songs = allSongs();
  const used = new Set<string>();
  list = [];
  while (list.length < PER_LAYER) {
    const nick = rnd() < 0.55 ? KNAMES[Math.floor(rnd() * KNAMES.length)] : HANDLES[Math.floor(rnd() * HANDLES.length)];
    if (used.has(nick)) continue;
    used.add(nick);
    const song = songs[Math.floor(rnd() * songs.length)];
    const riders = rnd() < 0.55 ? 0 : 1 + Math.floor(rnd() * 5);
    list.push({
      // 닉네임이 한글이면 로마자로 못 옮기므로 인덱스를 붙여 이메일이 겹치지 않게 한다
      email: `u${key}-${list.length}@ody.app`,
      nickname: nick,
      imageUrl: null,
      isOnline: rnd() > 0.12,
      isPublic: rnd() > 0.14,
      musicId: song.musicId,
      // 보고 있는 곡은 재생 중인 곡의 유사곡 중 하나 (재생곡과 다를 수 있다)
      viewingMusicId: (nearestSongs(song, 5)[Math.floor(rnd() * 5)] ?? song).musicId,
      genreId: song.genreId,
      meetingCount: 1 + Math.floor(rnd() * 6),
      riderCount: riders,
      followingNickname: null,
      avatarSeed: Array.from({ length: 6 }, () => Math.round(rnd() * 1000) / 1000),
    });
  }
  // 몇 명은 다른 사람을 따라가는 중
  list[1].followingNickname = list[0].nickname;
  list[5].followingNickname = list[3].nickname;
  byLayer.set(key, list);
  return list;
}

/** 모든 레이어의 사용자 (프로필·랭킹 조회용) */
function everyone(): NearbyUser[] {
  const out: NearbyUser[] = [];
  for (let l = 0; l < LAYER_COUNT; l++) out.push(...mockNearbyUsers(l));
  return out;
}

export function mockProfile(email: string): UserProfile {
  const isMe = email === MOCK_ME_EMAIL;
  const all = everyone();
  const idx = Math.max(0, all.findIndex((x) => x.email === email));
  const f = all[idx]?.email === email ? all[idx] : undefined;
  const base = isMe || !f ? mockMe() : { ...mockMe(), email, name: f.nickname, nickname: f.nickname, isPublic: f.isPublic };
  const song = allSongs()[f ? f.musicId - 1 : 41];
  return {
    ...base,
    isOnline: isMe || (f?.isOnline ?? false),
    followerCount: 12 + (idx % 24) * 7,
    followingCount: 8 + (idx % 24) * 3,
    daysSinceJoined: 19 + (idx % 40),
    nowPlaying: { id: song.musicId, title: song.title, artist: song.artist },
    meetingCount: isMe ? null : f?.meetingCount ?? 0,
    isFollowing: false,
    followingTarget: f?.followingNickname ? { email: "", nickname: f.followingNickname } : null,
    dashboard: {
      exploredCount: 128 + (idx % 24) * 10,
      discoveredCount: 37 + (idx % 24) * 4,
      moodPreference: MOODS.slice(0, 4).map((mood, i) => ({ mood, percent: [40, 30, 20, 10][i] })),
    },
  };
}

export function mockUserRanking(type: string): UserRankingItem[] {
  const list = everyone();
  const score = (f: NearbyUser, i: number) => (type === "topDriver" ? f.riderCount * 37 + (i % 13) : type === "topExplorer" ? 900 - (i % 29) * 31 : 4200 - (i % 31) * 140);
  return list
    .map((f, i) => ({ f, s: score(f, i) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map((x, i) => ({ rank: i + 1, email: x.f.email, nickname: x.f.nickname, imageUrl: null, score: x.s }));
}

export function mockPlaylistRanking(): PlaylistRankingItem[] {
  return [
    { rank: 1, playlistId: 1, playlistName: "새벽 드라이브", ownerNickname: "루나", likeCnt: 231 },
    { rank: 2, playlistId: 2, playlistName: "집중용", ownerNickname: "노바", likeCnt: 180 },
    { rank: 3, playlistId: 3, playlistName: "비 오는 날", ownerNickname: "오빗", likeCnt: 97 },
  ];
}
