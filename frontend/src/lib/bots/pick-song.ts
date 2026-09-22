"use client";

import type { QueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, BOTS, QUERY_KEYS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { api } from "@/lib/api";
import { isKnownArtist } from "@/lib/bots/known-artists";
import type { VideoIdLookup } from "@/types";

/**
 * 봇이 들을 곡 고르기 (S15P21A405-543 · 546 · 549).
 *
 * `use-bots` 안에 있던 것을 끌어냈다. 탑승하는 순간에도 같은 규칙이 필요한데
 * (`use-ride-mutation`), 훅 안에 있으면 부를 수가 없다.
 */

/**
 * 틀어 봤더니 안 되던 곡. 봇 전체가 같이 피한다 — 한 봇에게 안 되는 곡은 다른 봇에게도 안 된다.
 *
 * 새로고침하면 비는데, 그때는 다시 한 번 부딪혀 보고 다시 담는다. 남겨 둘 값어치보다
 * 저장소에 쌓이는 쪽이 성가시다.
 */
const dead = new Set<number>();

export const markDead = (musicId: number): void => void dead.add(musicId);

/**
 * 이 봇이 들을 곡 하나.
 *
 * **절반 넘게 내 곡 근처에서 고른다.** 주변 사람 패널은 "내가 듣는 곡과 비슷한 곡을 듣는 사람"
 * 이라, 아무 데서나 고르면 봇은 지도에만 보이고 그 패널에는 영영 안 뜬다 — 정작 따라가기를
 * 누르는 자리가 거기다.
 *
 * **아는 가수의 곡을 먼저 본다.** 662만 곡에서 무작위로 돌리면 사람이 모르는 곡만 나오는데,
 * 시연에서 "누가 이 곡을 듣고 있다" 는 아는 곡일 때만 사람으로 읽힌다. 그 겹에 아는 곡이
 * 거의 없으면 평소대로 고른다 — 한두 곡에 여섯이 겹쳐 서느니 모르는 곡이라도 흩어지는 편이 낫다.
 */
export function pickSong(layer: number, myLayer: number, myMusicId: number | null): number | null {
  const engine = getMapEngine();
  if (layer !== myLayer || !engine?.ready) return null;
  const playable = engine.songs.filter((s) => s.playable && !dead.has(s.musicId));
  const known = playable.filter((s) => isKnownArtist(s.artist));
  const songs = known.length >= BOTS.knownMin ? known : playable;
  if (songs.length === 0) return null;

  const mine = myMusicId != null ? engine.pointOf(myMusicId) : null;
  if (!mine || Math.random() < BOTS.wanderChance) return songs[Math.floor(Math.random() * songs.length)].musicId;

  const dx = layer * 2;
  const dy = dx + 1;
  const near = songs
    .map((s) => ({ id: s.musicId, d: (s.pc[dx] - mine.pc[dx]) ** 2 + (s.pc[dy] - mine.pc[dy]) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, BOTS.nearPool);
  return near[Math.floor(Math.random() * near.length)].id;
}

/**
 * **이 곡이 실제로 소리가 나는가** (S15P21A405-549).
 *
 * `playable` 은 유튜브 **검색어**를 만들 수 있다는 뜻일 뿐이다 (`youtubeUrl != null`). 실제로
 * 틀려면 조회가 `videoId` 를 줘야 하고, 그 결과가 셋이다 — `found`(된다) · `notFound`(찾아봤는데
 * 없다) · `unsearched`(아직 안 찾아봤다). **봇이 고른 곡은 대부분 `unsearched`** 라, 그대로 두면
 * 소리도 안 나고 넘어가지도 않는 곡에 서 있게 된다.
 *
 * `unsearched` 를 자동으로 안 넘기는 규칙(S15P21A405-364)은 **사용자가 고른 곡** 이야기다.
 * 다시 부르면 채워질 수 있으니 멋대로 버리면 안 된다. 봇이 고른 곡은 그렇지 않다 — 아무 곡이나
 * 괜찮으니 소리가 나는 것으로 바꾸면 된다.
 *
 * 화면이 쓰는 것과 **같은 캐시**를 쓴다. 곧 이어서 플레이어가 같은 곡을 물어보므로 요청은
 * 한 번만 나간다.
 */
export async function isAudible(qc: QueryClient, musicId: number): Promise<boolean> {
  if (dead.has(musicId)) return false;
  try {
    const res = await qc.fetchQuery<{ musicId: number; videoId: string | null; lookup: VideoIdLookup }>({
      queryKey: QUERY_KEYS.music.videoId(musicId),
      queryFn: () => api(API_ENDPOINTS.music.videoId(musicId)),
      staleTime: 30 * 60 * 1000,
    });
    if (res.lookup === "found" && res.videoId) return true;
  } catch {
    // 조회가 실패했다. 이 곡이 되는지 알 수 없으니 넘긴다 — 봇에게는 다른 곡이 얼마든지 있다
  }
  dead.add(musicId);
  return false;
}
