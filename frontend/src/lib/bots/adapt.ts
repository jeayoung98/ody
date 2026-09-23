"use client";

import { NO_GENRE_ID } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { seedOf } from "@/hooks/use-viewport-subscription";
import { rnd } from "@/lib/bots/sim";
import { isFollowingBot } from "@/stores/use-bot-store";
import { useFollowStore } from "@/stores/use-follow-store";
import type { BotLive } from "@/stores/use-bot-store";
import type { NearbyPerson, NearbyUser, UserProfile } from "@/types";

/**
 * 봇을 **실사용자와 같은 타입으로** 바꾼다 (S15P21A405-536).
 *
 * 여기가 봇 기능의 핵심이다. 지도·주변 사람 패널·프로필이 봇을 알아볼 필요가 없어야 한다 —
 * 알아보게 만들면 그 세 화면에 `if (봇)` 가지가 생기고, 그 가지는 실사용자 경로가 바뀔 때마다
 * 같이 썩는다. 봇은 `NearbyUser`·`NearbyPerson`·`UserProfile` 로 **변환되어** 섞여 들어간다.
 *
 * 화면이 봇을 가리는 유일한 자리는 **서버로 요청이 나가려는 순간**이고, 거기서는 `isBot()`
 * 한 줄을 본다 (`use-ride-mutation` 등).
 */

/** 이 겹에서 그 곡이 서 있는 원시 PC 좌표 */
function coordOf(musicId: number, layer: number): { x: number; y: number } | null {
  const p = getMapEngine()?.pointOf(musicId);
  if (!p) return null;
  return { x: p.pc[layer * 2], y: p.pc[layer * 2 + 1] };
}

/** 나와 몇 번 마주쳤나. 봇마다 고정값이라 볼 때마다 숫자가 바뀌지 않는다 */
const meetingsOf = (bot: BotLive) => Math.floor(rnd(bot.seed, 0, 99) * 14);

/**
 * 지도에 찍을 모습.
 *
 * `riderCount` 는 **내가 타고 있으면 1** 이다 — 엔진이 1 이상일 때 헬멧 대신 우주선을 그린다.
 * 태우고 있는데 헬멧이면 따라가기가 걸렸는지 화면으로 알 수 없다.
 */
export function botAsNearbyUser(bot: BotLive): NearbyUser | null {
  const { online, layer, musicId } = bot.episode;
  if (!online || musicId == null) return null;
  const at = coordOf(musicId, layer);

  return {
    email: bot.email,
    nickname: bot.nickname,
    imageUrl: bot.imageUrl,
    isOnline: true,
    musicId,
    viewingMusicId: musicId,
    genreId: getMapEngine()?.genreOf(musicId) ?? NO_GENRE_ID,
    meetingCount: meetingsOf(bot),
    riderCount: useFollowStore.getState().leaderEmail === bot.email ? 1 : 0,
    followingNickname: null,
    avatarSeed: seedOf(bot.email),
    x: at?.x,
    y: at?.y,
  };
}

/**
 * 주변 사람 목록에 넣을 모습.
 *
 * **자리만 채우고 거리는 안 잰다** (S15P21A405-582). 예전에는 여기서 내 곡과의 거리를 직접
 * 쟀다. 서버가 실사용자에게만 거리를 붙여 주니 봇도 같은 종류의 값을 가져야 한 목록에 섞을 수
 * 있었기 때문이다. 이제는 **부르는 쪽이 세 출처의 거리를 한 번에 다시 잰다** — 내가 곡을 옮기면
 * 서버 거리도 같이 낡기 때문이고, 그러면 여기서 미리 재 둘 이유가 없다.
 */
export function botAsNearbyPerson(bot: BotLive, layer: number): NearbyPerson | null {
  const { online, musicId } = bot.episode;
  if (!online || musicId == null) return null;
  const song = getMapEngine()?.pointOf(musicId);

  return {
    email: bot.email,
    nickname: bot.nickname,
    imageUrl: bot.imageUrl,
    meetingCount: meetingsOf(bot),
    riderCount: useFollowStore.getState().leaderEmail === bot.email ? 1 : 0,
    musicId,
    x: song ? song.pc[layer * 2] : null,
    y: song ? song.pc[layer * 2 + 1] : null,
    // 부르는 쪽이 좌표로 다시 잰다. 여기서 채워 봐야 덮어쓰인다
    distance: Number.POSITIVE_INFINITY,
  };
}

/**
 * 프로필 패널이 그릴 모습.
 *
 * 있지도 않은 값을 그럴듯하게 지어내지 않는다 — 팔로워 수 같은 것은 시드에서 뽑아 **고정**하고,
 * 대시보드는 `null` 로 둔다. `null` 은 "모른다" 는 뜻이고 화면이 그 줄을 안 그린다
 * (S15P21A405-531). 0 으로 채우면 "0곡 탐험했다" 는 거짓말이 된다.
 */
export function botAsProfile(bot: BotLive): UserProfile {
  const { online, musicId } = bot.episode;
  const song = musicId != null ? getMapEngine()?.pointOf(musicId) : null;
  const r = (salt: number) => rnd(bot.seed, 0, salt);

  return {
    email: bot.email,
    name: bot.nickname,
    nickname: bot.nickname,
    tutorialCompleted: true,
    lastActiveAt: new Date(bot.episode.startedAt).toISOString(),
    createdAt: new Date(Date.now() - Math.floor(r(11) * 90 + 10) * 86_400_000).toISOString(),
    updatedAt: null,
    imageUrl: bot.imageUrl,
    isOnline: online,
    followerCount: Math.floor(r(12) * 240),
    followingCount: Math.floor(r(13) * 120),
    daysSinceJoined: Math.floor(r(11) * 90 + 10),
    nowPlaying: song ? { id: song.musicId, title: song.title, artist: song.artist } : null,
    meetingCount: meetingsOf(bot),
    isFollowing: isFollowingBot(bot.email),
    followingTarget: null,
    dashboard: { exploredCount: null, discoveredCount: null, moodPreference: [] },
  };
}
