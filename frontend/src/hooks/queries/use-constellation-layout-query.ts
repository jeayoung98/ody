import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { ConstellationLayout } from "@/types";

/**
 * 별자리 배치 (PATH-01). 16차원을 2D로 압축한 **고정 모양**이라 레이어와 무관하다.
 * 같은 곡 집합이면 같은 결과이므로 캐시를 오래 들고 있는다.
 */
export function useConstellationLayoutQuery(musicIds: number[]) {
  return useQuery({
    queryKey: QUERY_KEYS.constellation.layout(musicIds),
    queryFn: () =>
      api<ConstellationLayout>(API_ENDPOINTS.constellation.layout, { method: "POST", body: JSON.stringify({ musicIds }) }),
    enabled: musicIds.length >= 2,
    staleTime: Infinity,
  });
}
