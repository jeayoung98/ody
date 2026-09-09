import type { PlaylistDetail, PlaylistSummary } from "@/types";
import { mockMusic, MOODS } from "./music";
import { MOCK_ME_EMAIL } from "./user";

/** 서버 재시작 전까지 유지되는 인메모리 목 저장소 */
const store = new Map<number, PlaylistDetail>();
let nextId = 10;

function seedPlaylist(id: number, name: string, email: string, owner: string, musicIds: number[], likeCnt: number) {
  const items = musicIds.map((musicId) => ({
    playlistId: id,
    musicId,
    addedAt: new Date().toISOString(),
    music: mockMusic(musicId),
  }));
  store.set(id, {
    id,
    email,
    playlistName: name,
    likeCnt,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    ownerNickname: owner,
    moodTags: MOODS.slice(id % 3, (id % 3) + 3),
    itemCount: items.length,
    totalDuration: items.reduce((s, it) => s + (it.music.duration ?? 0), 0),
    isLiked: id === 2,
    items,
  });
}

seedPlaylist(1, "새벽 드라이브", "luna@ody.app", "루나", [1, 5, 9, 14, 22], 231);
seedPlaylist(2, "집중용", "nova@ody.app", "노바", [3, 7, 11], 180);
seedPlaylist(3, "내 첫 플리", MOCK_ME_EMAIL, "우주탐험가", [2, 8], 4);

function recompute(p: PlaylistDetail) {
  p.itemCount = p.items.length;
  p.totalDuration = p.items.reduce((s, it) => s + (it.music.duration ?? 0), 0);
  p.updatedAt = new Date().toISOString();
}

function toSummary(p: PlaylistDetail): PlaylistSummary {
  return { id: p.id, playlistName: p.playlistName, likeCnt: p.likeCnt, itemCount: p.itemCount, ownerNickname: p.ownerNickname };
}

export const mockPlaylists = {
  get: (id: number) => store.get(id) ?? null,
  mine: () => [...store.values()].filter((p) => p.email === MOCK_ME_EMAIL).map(toSummary),
  liked: () => [...store.values()].filter((p) => p.isLiked).map(toSummary),
  create: (name: string) => {
    const id = nextId++;
    seedPlaylist(id, name, MOCK_ME_EMAIL, "우주탐험가", [], 0);
    return store.get(id)!;
  },
  addItem: (id: number, musicId: number) => {
    const p = store.get(id);
    if (!p) return null;
    if (!p.items.some((it) => it.musicId === musicId)) {
      p.items.push({ playlistId: id, musicId, addedAt: new Date().toISOString(), music: mockMusic(musicId) });
      recompute(p);
    }
    return p;
  },
  removeItem: (id: number, musicId: number) => {
    const p = store.get(id);
    if (!p) return null;
    p.items = p.items.filter((it) => it.musicId !== musicId);
    recompute(p);
    return p;
  },
  toggleLike: (id: number) => {
    const p = store.get(id);
    if (!p) return null;
    p.isLiked = !p.isLiked;
    p.likeCnt = (p.likeCnt ?? 0) + (p.isLiked ? 1 : -1);
    return p;
  },
  remove: (id: number) => store.delete(id),
};
