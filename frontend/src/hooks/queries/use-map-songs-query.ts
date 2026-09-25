import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, MAP_SONGS_STORE, QUERY_KEYS } from "@/constants";
import {
  forgetLayerSetsExcept,
  layerSetUsedAt,
  layerSetsToEvict,
  touchLayerSet,
} from "@/lib/map-songs-cache";
import { readTopLevelSongs, writeTopLevelSongs } from "@/lib/map-songs-store";
import type { LayerBox, MapPoint } from "@/types";

function fetchTopLevelSongs(): Promise<MapPoint[]> {
  return api<MapPoint[]>(API_ENDPOINTS.map.songs([]));
}

/**
 * 첫 화면이 뜬 뒤, 브라우저가 한가할 때 한 번 돌린다. 저장은 5,745곡을 통째로 복사하느라 메인 스레드를
 * 잠깐 잡는다(데스크톱 쓰기 35~63ms, 폰은 몇 배) — 지도를 처음 그리는 순간과 겹치면 안 된다.
 * `requestIdleCallback` 이 없는 브라우저(iOS 사파리 등)는 기다린 뒤 바로 돈다.
 */
function whenIdleAfterFirstScreen(run: () => void): void {
  setTimeout(() => {
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(run, { timeout: MAP_SONGS_STORE.refreshDelayMs });
    else run();
  }, MAP_SONGS_STORE.refreshDelayMs);
}

/** 새로 받아 저장하는 것은 페이지를 연 뒤 한 번이면 된다 — 1겹 집합은 세션 중에 바뀌지 않는다 */
let refreshScheduled = false;

/**
 * **1겹(전 우주)은 브라우저에 저장해 둔 것이 있으면 그걸로 먼저 그린다** (S15P21A405-680).
 *
 * 폰 조건(CPU×4·LTE 10Mbps)에서 재방문 첫 곡 2.6초 중 65%(1.7초)가 이 1,576KB 를 다시 받는 시간이었다 — 모두에게
 * 같은 전 우주 집합인데 새로고침마다 받았다(PERF-LOG 2026-09-26 로딩 기준선).
 *
 * 새 데이터는 첫 화면 뒤에 받아 **저장만** 하고 지금 보고 있는 지도에는 넣지 않는다. 1겹 집합이 바뀌었으면(데이터
 * 파트가 표본을 다시 만든 주) 엔진이 곡을 갈아끼우며 카메라를 다시 맞춰 보던 화면이 튄다. 한 방문 늦게 반영되는 대신
 * 화면이 흔들리지 않는다. 오래된 저장본(`MAP_SONGS_STORE.maxAgeMs`)이나 모양이 바뀐 저장본은 안 쓰고 새로 받는다.
 */
async function loadTopLevelSongs(): Promise<MapPoint[]> {
  const saved = await readTopLevelSongs();
  if (saved) {
    if (!refreshScheduled) {
      refreshScheduled = true;
      whenIdleAfterFirstScreen(() => {
        fetchTopLevelSongs()
          .then((fresh) => writeTopLevelSongs(fresh))
          .catch(() => {});
      });
    }
    return saved;
  }
  const fresh = await fetchTopLevelSongs();
  whenIdleAfterFirstScreen(() => void writeTopLevelSongs(fresh));
  return fresh;
}

/**
 * 이 겹의 상주 집합 (PC 16개 포함). 겹마다 새로 받는다 — 한 번 받아 8겹을 재투영하지 않는다.
 *
 * `boxes` 는 이전 겹들에서 좁힌 누적 범위이고, 그대로 캐시 키가 된다.
 * 그래서 떠오르면 상위 겹 집합은 **재요청 없이 캐시에서** 돌아오고,
 * 범위를 새로 좁혀 내려가면 새 키가 되어 그 영역 곡을 받는다.
 *
 * **들고 있는 수에는 상한이 있다** (S15P21A405-586). `gcTime: Infinity` 는 오르내리는 길을
 * 끊기지 않게 하려는 것이지 세션 내내 모두 쥐고 있으라는 뜻이 아니었다 — 새 경로로 좁혀
 * 들어갈 때마다 키가 늘기만 했다. 넘치면 가장 오래 안 쓴 것부터 내보낸다. 판단은
 * [`map-songs-cache`](../../lib/map-songs-cache.ts) 에 있고, **보는 컴포넌트가 있는 집합은
 * 후보에서 빠지므로** 지금 그리는 겹과 미리 받아 둔 다음 겹은 지워지지 않는다.
 */
export function useMapSongsQuery(boxes: readonly LayerBox[]) {
  const queryClient = useQueryClient();
  const queryKey = QUERY_KEYS.map.songs(boxes);
  const rangeKey = queryKey[2];

  const query = useQuery({
    queryKey,
    // 1겹만 브라우저 저장본을 먼저 쓴다. 파고든 겹은 범위마다 달라 저장하지 않는다
    queryFn: boxes.length === 0 ? loadTopLevelSongs : () => api<MapPoint[]>(API_ENDPOINTS.map.songs(boxes)),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  /**
   * 범위가 바뀔 때만 돈다 — 쓴 순서를 적고, 넘쳤으면 정리한다. 매 프레임 도는 자리가 아니라
   * 겹을 옮기거나 범위를 좁힐 때 한 번이고, 훑는 대상도 상한 언저리 개수뿐이다.
   */
  useEffect(() => {
    touchLayerSet(rangeKey);
    const cached = queryClient.getQueryCache().findAll({ queryKey: ["map", "songs"] });
    const present = new Set(cached.map((q) => String(q.queryKey[2])));
    forgetLayerSetsExcept(present);
    const drop = layerSetsToEvict(
      cached.map((q) => {
        const key = String(q.queryKey[2]);
        return { key, active: q.getObserversCount() > 0, usedAt: layerSetUsedAt(key) };
      }),
    );
    for (const key of drop) queryClient.removeQueries({ queryKey: ["map", "songs", key], exact: true });
  }, [queryClient, rangeKey]);

  return query;
}
