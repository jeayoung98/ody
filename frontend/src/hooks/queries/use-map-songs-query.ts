import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { LayerBox, MapPoint } from "@/types";

/**
 * 이 겹의 상주 집합 (PC 16개 포함). 겹마다 새로 받는다 — 한 번 받아 8겹을 재투영하지 않는다.
 *
 * `boxes` 는 이전 겹들에서 좁힌 누적 범위이고, 그대로 캐시 키가 된다.
 * 그래서 떠오르면 상위 겹 집합은 **재요청 없이 캐시에서** 돌아오고,
 * 범위를 새로 좁혀 내려가면 새 키가 되어 그 영역 곡을 받는다.
 */
export function useMapSongsQuery(boxes: readonly LayerBox[]) {
  return useQuery({
    queryKey: QUERY_KEYS.map.songs(boxes),
    queryFn: () => api<MapPoint[]>(API_ENDPOINTS.map.songs(boxes)),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
