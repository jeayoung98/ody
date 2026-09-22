"use client";

import { useMemo } from "react";
import { botAsNearbyPerson } from "@/lib/bots/adapt";
import { useBotStore } from "@/stores/use-bot-store";
import { useMapStore } from "@/stores/use-map-store";
import type { NearbyPerson } from "@/types";

/**
 * 서버가 준 주변 사람에 **데모 봇을 섞어** 가까운 순으로 돌려준다 (S15P21A405-536).
 *
 * 패널이 아니라 훅에 둔 이유는 정렬 때문이다. 봇을 목록 끝에 붙이면 거리 순서가 깨져 "가까운
 * 순" 이라는 패널의 설명이 거짓말이 되고, 레이더(`nearby-radar`)도 같은 목록을 거리로 찍으므로
 * 둘이 어긋난다. 합친 뒤 한 번 정렬한다.
 *
 * **봇도 지금 겹에 있는 것만 넣는다.** 다른 겹에 가 있는 봇은 지도에 없는데 목록에만 있으면
 * 눌러도 찾을 수 없는 사람이 된다.
 */
export function useNearbyWithBots(people: NearbyPerson[] | undefined): NearbyPerson[] {
  const bots = useBotStore((s) => s.bots);
  const layer = useMapStore((s) => s.layer);
  const myMusicId = useMapStore((s) => s.myMusicId);

  return useMemo(() => {
    const merged = [...(people ?? [])];
    for (const bot of bots) {
      if (bot.episode.layer !== layer) continue;
      const as = botAsNearbyPerson(bot, myMusicId);
      if (as) merged.push(as);
    }
    return merged.sort((a, b) => a.distance - b.distance);
  }, [people, bots, layer, myMusicId]);
}
