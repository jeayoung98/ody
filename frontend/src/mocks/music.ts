/**
 * 목 곡 상세/검색/여정. 좌표 데이터셋은 songs.ts 와 공유한다.
 * NEXT_PUBLIC_API_URL 이 실제 백엔드를 가리키면 이 파일과 src/app/api/* 는 쓰이지 않는다.
 */
import { NEARBY_COUNT } from "@/constants";
import type { JourneyRoute, Music, MusicDetail, MusicSearchResult, NearbyResponse } from "@/types";
import { seeded } from "./seed";
import { allSongs, embDist, GENRE_NAMES, MOODS, nearestSongs, songById } from "./songs";

export { GENRE_NAMES, MOODS };

export function mockMusic(id: number): Music {
  const s = songById(id);
  const rand = seeded(id);
  return {
    id,
    mbid: `mock-${id.toString(16).padStart(8, "0")}`,
    title: s?.title ?? `Track ${id}`,
    artist: s?.artist ?? `Artist ${(id % 40) + 1}`,
    releaseYear: 1968 + Math.floor(rand() * 57),
    bpm: Math.round((62 + rand() * 110) * 10) / 10,
    duration: 96 + Math.floor(rand() * 268),
    album: `Album ${(id % 25) + 1}`,
    youtubeUrl: s && !s.playable ? null : `https://www.youtube.com/watch?v=mock${id}`,
    location: s ? (s.pc as Music["location"]) : null,
    playCnt: s?.weight ?? Math.floor(rand() * 50_000),
    youtubeCnt: s && !s.playable ? 0 : 1 + Math.floor(rand() * 3),
  };
}

export function mockMusicDetail(id: number): MusicDetail {
  const base = mockMusic(id);
  const s = songById(id);
  const genreId = s?.genreId ?? id % GENRE_NAMES.length;
  const pc = s?.pc ?? [];
  return {
    ...base,
    albumCoverUrl: null,
    country: "KR",
    language: "ko",
    composer: `Composer ${(id % 15) + 1}`,
    lyricist: `Lyricist ${(id % 12) + 1}`,
    moods: [MOODS[id % MOODS.length], MOODS[(id + 2) % MOODS.length]],
    genres: [{ id: genreId, name: GENRE_NAMES[genreId] }],
    principalComponents: pc.slice(0, 6).map((v, i) => ({ label: `PC${i + 1}`, value: Math.max(-1, Math.min(1, v / 2.5)) })),
    nearby: (s ? nearestSongs(s, NEARBY_COUNT) : []).map((p) => ({ id: p.musicId, title: p.title, artist: p.artist })),
    relatedPlaylists: [
      { id: 1, playlistName: "새벽 드라이브", email: "luna@ody.app" },
      { id: 2, playlistName: "집중용", email: "nova@ody.app" },
    ],
  };
}

export function mockNearby(musicId: number): NearbyResponse {
  const center = songById(musicId) ?? allSongs()[0];
  return { center, neighbors: nearestSongs(center, NEARBY_COUNT) };
}

/** 고스트별 디자인을 눈으로 확인하는 키워드 (SearchBar 가 이 접두를 보고 강제 고스트로 띄운다) */
export const GHOST_PROBE_KEYWORD = "고스트별";

export function mockSearch(keyword: string): MusicSearchResult[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  // 확인용: 아무 곡이나 몇 개 돌려주고, 고른 곡을 고스트별로 띄운다
  if (q.startsWith(GHOST_PROBE_KEYWORD)) {
    return allSongs()
      .slice(0, 6)
      .map((p) => ({ id: p.musicId, title: p.title, artist: p.artist }));
  }
  return allSongs()
    .filter((p) => p.title.toLowerCase().includes(q) || (p.artist ?? "").toLowerCase().includes(q))
    .slice(0, 9)
    .map((p) => ({ id: p.musicId, title: p.title, artist: p.artist }));
}

/**
 * 여정 경로 — **16차원 임베딩 공간**에서 출발 → 도착으로 한 걸음씩 건너간다.
 * 각 걸음은 "직전 곡과 가깝고(부드러운 전환) 도착에는 가까워지는" 곡을 고른다.
 * 2D 평면 직선 보간이 아니므로 어느 레이어에 투영해도 일직선이 아니고 레이어마다 모양이 달라진다 (PATH-01).
 */
export function mockJourney(startId: number, endId: number): JourneyRoute {
  const songs = allSongs();
  const a = songById(startId) ?? songs[0];
  const b = songById(endId) ?? songs[1];
  const N = 20;
  const used = new Set([a.musicId, b.musicId]);
  const path = [a];
  let cur = a;
  for (let i = 1; i < N - 1; i++) {
    const remain = N - 1 - i;
    let best: (typeof songs)[number] | null = null;
    let bestScore = Infinity;
    for (const s of songs) {
      if (used.has(s.musicId) || !s.playable) continue;
      const step = embDist(cur, s);
      if (step < 1e-6) continue;
      // 한 걸음은 짧게, 남은 걸음 수로 나눈 도착까지의 거리는 줄어들게
      const score = step + embDist(s, b) / remain;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) break;
    used.add(best.musicId);
    path.push(best);
    cur = best;
  }
  path.push(b);
  const stops = path.map((s, i) => {
    const m = mockMusic(s.musicId);
    return { id: s.musicId, title: s.title, artist: s.artist, duration: m.duration, order: i, genreName: GENRE_NAMES[s.genreId] };
  });
  return { startMusicId: a.musicId, endMusicId: b.musicId, stops, totalDuration: stops.reduce((sum, s) => sum + (s.duration ?? 0), 0) };
}
