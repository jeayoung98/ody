"use client";

import { useEffect, useMemo, useState } from "react";
import { ODY_BOTS } from "@/constants";
import { mockMusic } from "@/mocks/music";
import { allSongs } from "@/mocks/songs";
import type { NearbyPerson } from "@/types";

/**
 * 오디봇 — 주변에 아무도 없을 때 지도를 돌아다니는 우리 쪽 봇 (S15P21A405-496).
 *
 * **사람인 척하지 않는다.** 닉네임이 `오디봇 …` 이고 화면에도 봇 표시가 붙는다. 이 저장소는
 * 목이 실데이터인 척하는 것을 반복해서 막아 왔는데(`playlists/liked/route.ts` 의 주석), 봇은
 * 그 선을 넘지 않는 유일한 방법이다 — **가짜 사람이 아니라 진짜 봇**이라서 화면이 거짓말을
 * 하지 않는다. 나중에 지울 때도 "사람이 줄었다" 로 보이지 않는다.
 *
 * **곡을 제대로 듣는다.** 예전 목은 몇 초 만에 갈아치워서 대충 듣고 넘기는 것처럼 보였다.
 * 지금은 60%의 확률로 한 곡을 **끝까지** 듣고, 아니면 40~85% 지점에서 넘긴다. 곡마다 길이가
 * 달라 봇들이 동시에 움직이지도 않는다.
 */

/** 이 이메일이 오디봇인가. 화면이 봇을 사람과 다르게 그릴 때 쓴다 */
export const isOdyBot = (email: string) => email.startsWith("bot-") && email.endsWith("@ody.app");

const NAMES = ["오디봇 루나", "오디봇 미로", "오디봇 노아", "오디봇 네오", "오디봇 세라"];

/** 이 봇이 이 곡을 얼마나 들을지(ms). 곡 길이를 모르면 기본 범위에서 고른다 */
export function listenMsFor(durationSec: number | null, rnd: () => number): number {
  const full = durationSec && durationSec > 0 ? durationSec * 1000 : ODY_BOTS.maxListenMs;
  const [lo, hi] = ODY_BOTS.partialRange;
  const share = rnd() < ODY_BOTS.fullListenChance ? 1 : lo + rnd() * (hi - lo);
  return Math.max(ODY_BOTS.minListenMs, Math.round(full * share));
}

/** 씨드 난수 — 같은 봇은 새로고침해도 같은 성격이다 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Bot {
  email: string;
  nickname: string;
  meetingCount: number;
  rnd: () => number;
}

/**
 * @param enabled 진짜 사람이 없을 때만 참. 한 명이라도 있으면 봇이 자리를 빼앗으면 안 된다
 */
export function useOdyBots(enabled: boolean): NearbyPerson[] {
  const bots = useMemo<Bot[]>(
    () =>
      Array.from({ length: ODY_BOTS.count }, (_, i) => ({
        email: `bot-${i}@ody.app`,
        nickname: NAMES[i % NAMES.length],
        // 봇마다 다른 만남 횟수를 줘야 레이더의 크기 차이가 보인다
        meetingCount: 1 + i * 2,
        rnd: seeded(9001 + i * 733),
      })),
    [],
  );

  /** 지금 각 봇이 듣는 곡. 곡이 바뀔 때마다 새 타이머를 건다 */
  const [songs, setSongs] = useState<number[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const pool = allSongs();
    if (pool.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const pick = (i: number) => {
      const bot = bots[i];
      const song = pool[Math.floor(bot.rnd() * pool.length)];
      setSongs((prev) => {
        const next = prev.length === bots.length ? [...prev] : Array.from({ length: bots.length }, () => 0);
        next[i] = song.musicId;
        return next;
      });
      // 한 곡을 다 듣고 나서야 다음 곡으로 간다 — 대충 넘기지 않는다
      timers[i] = setTimeout(() => pick(i), listenMsFor(mockMusic(song.musicId).duration, bot.rnd));
    };
    /**
     * **첫 곡도 타이머로 고른다.** 효과 본문에서 바로 setState 하면 렌더가 한 번 더 돈다
     * (`react-hooks/set-state-in-effect`). 봇의 시계는 어차피 외부 장치라, 첫 박도 거기서
     * 시작하는 편이 맞다.
     */
    bots.forEach((_, i) => {
      timers[i] = setTimeout(() => pick(i), 0);
    });
    return () => timers.forEach(clearTimeout);
  }, [enabled, bots]);

  // 꺼져 있으면 여기서 빈 배열이다 — 상태를 따로 비우지 않는다(효과에서 setState 하지 않으려고)
  return useMemo(() => {
    if (!enabled || songs.length !== bots.length) return [];
    return bots.map((bot, i) => {
      const m = mockMusic(songs[i]);
      return {
        email: bot.email,
        nickname: bot.nickname,
        imageUrl: null,
        meetingCount: bot.meetingCount,
        riderCount: 0,
        musicId: songs[i],
        title: m.title,
        artist: m.artist,
        // 레이더의 반지름이 봇마다 갈리게 — 값 자체에 뜻은 없다
        distance: (i + 1) * 0.9,
      };
    });
  }, [enabled, bots, songs]);
}
