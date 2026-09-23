"use client";

import { useMemo } from "react";
import { LAYER_USERS } from "@/constants";
import { useLayerUsersQuery } from "@/hooks/queries/use-layer-users-query";
import { botAsNearbyPerson } from "@/lib/bots/adapt";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { layerPointOf } from "@/lib/layer-point";
import { distanceBetween, distanceFrom, nearestFirst, radiusFromNeighbors, withinRadius, type Point } from "@/lib/nearby-from-layer";
import { useBotStore } from "@/stores/use-bot-store";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import type { LayerUsersSnapshot, NearbyPerson } from "@/types";

/**
 * 주변 사람 패널이 실제로 그리는 목록 — **출처가 셋이다** (S15P21A405-536 · 541 · 582).
 *
 * 1. `POST /api/realtime/nearby` — 서버 목록. **기준이 내 층 전체다** (5차 명세). 만남 횟수가
 *    들어 있고 가까운 순으로 상한까지 서버가 잘라 준다. 다만 **소켓·presence·재생 선언이 다
 *    살아 있어야** 답이 온다.
 * 2. `GET /api/realtime/layers/{layer}/users` — 그냥 REST 폴링이라 소켓이 죽어 있어도 온다.
 *    지도에 이미 이 사람들이 찍히고 있는데 패널만 비어 있으면, 같은 사람을 두 화면이 다르게
 *    말하는 셈이 된다.
 * 3. 데모 봇 — 아무도 없을 때 따라가기를 시연할 상대.
 *
 * **순서가 곧 우선순위다.** 같은 사람이 여러 출처에 있으면 앞엣것이 이긴다.
 *
 * **거리는 여기서 한 번에 다시 잰다.** 출처마다 기준이 다르면 한 목록 안에서 정렬이 뒤섞인다.
 * 게다가 서버 거리는 **층을 옮길 때만** 새로 오므로(5차 명세 §3), 내가 같은 층에서 곡을 바꾸면
 * 그 값이 낡는다 — 좌표가 있으니 매번 다시 재는 편이 싸고 정확하다.
 */
export function useNearbyList(fromServer: NearbyPerson[] | undefined, enabled: boolean): NearbyPerson[] {
  const bots = useBotStore((s) => s.bots);
  const layer = useMapStore((s) => s.layer);
  const myMusicId = useMapStore((s) => s.myMusicId);
  /**
   * **따라가는 중에는 인솔자 곡이 기준이다** (S15P21A405-557).
   *
   * 내 곡은 인솔자를 따라 같이 옮겨지지만, 그 갱신이 한 박자 늦을 수 있고 무엇보다 이 화면이
   * 말하는 "주변" 은 **지금 내가 실려 가고 있는 곳의 주변**이다. 서버 `nearby` 는 이때
   * 거부되므로(`RIDE_NOT_CAPTAIN`) 겹 사용자 조회로 만든 목록이 유일한 재료다.
   */
  const leaderMusicId = useFollowStore((s) => s.leaderMusicId);
  const anchorMusicId = leaderMusicId ?? myMusicId;
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

    for (const bot of bots) {
      if (bot.episode.layer !== layer || seen.has(bot.email)) continue;
      const as = botAsNearbyPerson(bot, layer);
      if (!as) continue;
      merged.push(as);
      seen.add(as.email);
    }

    for (const p of fromLayer(layerUsers, seen)) merged.push(p);

    /**
     * 거리를 전부 다시 재고, **경계 안만 남기고**, 가까운 순으로 상한까지 자른다.
     * 세 규칙이 한 자리에 있어야 출처가 몇이든 패널이 같은 뜻을 갖는다.
     *
     * 경계가 먼저다 (S15P21A405-596). 서버 상한은 열두 명을 *채우는* 값이라 사람이 적은 층에서
     * **층 반대편 사람까지 넣어 준다** — 그걸 그대로 그리면 "주변 사람" 이 아니라 "이 층 사람"
     * 이 된다. 가까이 아무도 없으면 비는 것이 맞고, 화면은 그때 안내 한 줄을 띄운다.
     */
    const me = layerPointOf(anchorMusicId, layer);
    const placed = merged.map((p) => ({ ...p, distance: distanceFrom(me, pointOfPerson(p, layer)) }));
    return nearestFirst(withinRadius(placed, nearRadius(layer, me)), LAYER_USERS.maxInPanel);
  }, [enabled, fromServer, bots, layer, anchorMusicId, layerUsers]);
}

/**
 * "가깝다" 의 경계 (S15P21A405-596). 내 자리를 모르면 `null` — 잴 기준이 없다.
 *
 * 이 겹 상주 집합을 한 번 훑는다. 1,000곡짜리 배열이고 목록을 다시 만들 때만 도는 자리라
 * 값이 싸다. 고정 숫자를 안 쓰는 이유는 `radiusFromNeighbors` 에 적어 뒀다.
 */
function nearRadius(layer: number, me: Point | null): number | null {
  const engine = getMapEngine();
  if (!engine || !me) return null;
  const dx = layer * 2;
  const dy = dx + 1;
  return radiusFromNeighbors(
    engine.songs.map((s) => distanceBetween({ x: s.pc[dx], y: s.pc[dy] }, me)),
    LAYER_USERS.neighborK,
  );
}

/**
 * 그 사람이 서 있는 자리.
 *
 * **서버가 준 좌표를 먼저 쓴다.** 그 사람의 곡이 이 겹 상주 집합 밖일 수 있고, 그러면 지도는
 * 좌표를 모른다 — 서버만 아는 자리다.
 *
 * 좌표가 비어 있으면 듣는 곡으로 지도에서 찾아본다. 델타(`NEARBY_ENTER`·`MOVE`)가 자리를 못
 * 구해 `null` 로 보내는 드문 경우와, 좌표를 사람마다 싣지 않는 `NEARBY_BULK_ENTER` 가 여기다.
 */
function pointOfPerson(p: NearbyPerson, layer: number): Point | null {
  if (p.x != null && p.y != null) return { x: p.x, y: p.y };
  return layerPointOf(p.musicId, layer);
}

/**
 * 겹 사용자 응답을 `NearbyPerson` 으로. **자르지 않는다** (S15P21A405-582) — 상한은 합친 뒤
 * 한 번만 걸고, 거리도 부르는 쪽이 잰다.
 */
function fromLayer(snapshot: LayerUsersSnapshot | undefined, seen: ReadonlySet<string>): NearbyPerson[] {
  if (!snapshot) return [];

  // 응답은 곡별 묶음이다. 좌표가 묶음에 붙어 있어 사람 쪽으로 옮겨 편다
  const out: NearbyPerson[] = [];
  for (const g of snapshot.groups) {
    for (const u of g.users) {
      if (seen.has(u.email)) continue;
      out.push({
        email: u.email,
        nickname: u.nickname,
        imageUrl: u.imageUrl,
        /**
         * 이 응답에는 **만남 횟수가 없다** (백엔드 명세: `viewingMusicId`·`genreId`·
         * `meetCount` 는 안 온다). 0 이면 화면이 그 자리를 안 그린다 — 지어내지 않는다.
         */
        meetingCount: 0,
        riderCount: u.riderCount,
        musicId: g.musicId,
        x: g.x,
        y: g.y,
        // 부르는 쪽이 다시 잰다. 여기서 채워 봐야 덮어쓰인다
        distance: Number.POSITIVE_INFINITY,
      });
    }
  }
  return out;
}
