"use client";

import { useMemo } from "react";
import { LAYER_USERS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { useLayerUsersQuery } from "@/hooks/queries/use-layer-users-query";
import { botAsNearbyPerson } from "@/lib/bots/adapt";
import { distanceBetween, pickNearby, radiusFromNeighbors, type Placed } from "@/lib/nearby-from-layer";
import { useBotStore } from "@/stores/use-bot-store";
import { useMapStore } from "@/stores/use-map-store";
import type { LayerUsersSnapshot, NearbyPerson } from "@/types";

/**
 * 주변 사람 패널이 실제로 그리는 목록 — **출처가 셋이다** (S15P21A405-536 · 541).
 *
 * 1. `POST /api/realtime/nearby` — 서버가 "비슷한 곡" 을 계산해 준 목록. 제일 좋다. 만남 횟수와
 *    곡 제목이 들어 있고 기준도 서버가 잡는다. 다만 **소켓·presence·재생 선언이 다 살아 있어야**
 *    답이 온다.
 * 2. `GET /api/realtime/layers/{layer}/users` 중 **가까운 사람** — 그냥 REST 폴링이라 소켓이
 *    죽어 있어도 온다. 지도에 이미 이 사람들이 찍히고 있는데 패널만 비어 있으면, 같은 사람을
 *    두 화면이 다르게 말하는 셈이 된다.
 * 3. 데모 봇 — 아무도 없을 때 따라가기를 시연할 상대.
 *
 * **순서가 곧 우선순위다.** 같은 사람이 여러 출처에 있으면 앞엣것이 이긴다.
 *
 * 패널이 아니라 훅에 둔 이유는 정렬 때문이다. 뒤에 붙이기만 하면 거리 순서가 깨져 "가까운 순"
 * 이라는 패널의 설명이 거짓말이 되고, 레이더(`nearby-radar`)도 같은 목록을 거리로 찍으므로
 * 둘이 어긋난다. 합친 뒤 한 번 정렬한다.
 */
export function useNearbyList(fromServer: NearbyPerson[] | undefined, enabled: boolean): NearbyPerson[] {
  const bots = useBotStore((s) => s.bots);
  const layer = useMapStore((s) => s.layer);
  const myMusicId = useMapStore((s) => s.myMusicId);
  /**
   * 지도가 이미 부르고 있는 그 조회다. 키가 같아 요청이 두 번 나가지 않는다 — 패널이 열려
   * 있든 아니든 지도가 폴링하고 있으므로, 여기서는 캐시를 읽는 셈이다.
   */
  const { data: layerUsers } = useLayerUsersQuery(layer, enabled);

  return useMemo(() => {
    /**
     * **끄면 아무것도 안 준다.** 남을 따라가는 동안이 그런 경우다 — 패널은 "따라가는 동안에는
     * 주변 사람을 볼 수 없어요" 라고 말하는데(§6), 겹 조회는 지도 쪽에서 계속 돌고 있어서
     * 그 캐시를 그냥 읽으면 안내문 밑에 사람이 깔린다. 화면이 제 말을 뒤집는 셈이다.
     */
    if (!enabled) return [];

    const merged = [...(fromServer ?? [])];
    const seen = new Set(merged.map((p) => p.email));

    // 지금 겹에 있는 봇만. 다른 겹에 가 있으면 지도에 없는데 목록에만 있는 사람이 된다
    for (const bot of bots) {
      if (bot.episode.layer !== layer || seen.has(bot.email)) continue;
      const as = botAsNearbyPerson(bot, myMusicId);
      if (as) {
        merged.push(as);
        seen.add(as.email);
      }
    }

    for (const p of fromLayer(layerUsers, layer, myMusicId, seen)) merged.push(p);
    return merged.sort((a, b) => a.distance - b.distance);
  }, [enabled, fromServer, bots, layer, myMusicId, layerUsers]);
}

/**
 * 겹 사용자 중 내 근처 사람을 `NearbyPerson` 으로.
 *
 * **내 자리를 모르면 아무도 안 넣는다.** 아직 아무 곡도 재생하지 않았다는 뜻이고, 그때는
 * "가깝다" 를 잴 기준 자체가 없다 — 아무 데나 잘라 넣는 것보다 비워 두는 편이 정직하다.
 */
function fromLayer(
  snapshot: LayerUsersSnapshot | undefined,
  layer: number,
  myMusicId: number | null,
  seen: ReadonlySet<string>,
): NearbyPerson[] {
  const engine = getMapEngine();
  const mine = myMusicId != null ? engine?.pointOf(myMusicId) : null;
  if (!snapshot || !engine || !mine) return [];

  const dx = layer * 2;
  const dy = dx + 1;
  const me = { x: mine.pc[dx], y: mine.pc[dy] };

  /**
   * 경계는 이 겹의 곡 분포에서 뽑는다 (`radiusFromNeighbors`). 상주 집합을 한 번 훑는데,
   * 1,000곡짜리 배열이고 10초에 한 번 도는 자리라 값이 싸다.
   */
  const radius = radiusFromNeighbors(
    engine.songs.map((s) => distanceBetween({ x: s.pc[dx], y: s.pc[dy] }, me)),
    LAYER_USERS.neighborK,
  );

  // 응답은 곡별 묶음이다. 좌표가 묶음에 붙어 있어 사람 쪽으로 옮겨 편다
  const flat: (Placed & { musicId: number; nickname: string | null; imageUrl: string | null; riderCount: number })[] = [];
  for (const g of snapshot.groups) {
    for (const u of g.users) flat.push({ ...u, musicId: g.musicId, x: g.x, y: g.y });
  }

  return pickNearby(flat, me, radius, LAYER_USERS.maxInPanel, seen).map((u) => {
    const song = engine.pointOf(u.musicId);
    return {
      email: u.email,
      nickname: u.nickname,
      imageUrl: u.imageUrl,
      /**
       * 이 응답에는 **만남 횟수가 없다** (백엔드 명세: `isPublic`·`viewingMusicId`·`genreId`·
       * `meetCount` 는 안 온다). 0 이면 화면이 그 자리를 안 그린다 — 지어내지 않는다.
       */
      meetingCount: 0,
      riderCount: u.riderCount,
      musicId: u.musicId,
      // 곡 제목은 상주 집합에서 빌려 온다. 이 겹에 있는 곡이라 거의 항상 잡힌다
      title: song?.title ?? "",
      artist: song?.artist ?? null,
      distance: u.distance,
    };
  });
}
