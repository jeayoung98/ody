import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import {
  forgetLayerSetsExcept,
  layerSetUsedAt,
  layerSetsToEvict,
  touchLayerSet,
} from "@/lib/map-songs-cache";
import type { LayerBox, MapPoint } from "@/types";

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
    queryFn: () => api<MapPoint[]>(API_ENDPOINTS.map.songs(boxes)),
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
