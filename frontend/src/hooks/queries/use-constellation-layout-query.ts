import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, CONSTELLATION_MAX_SONGS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { ConstellationLayout } from "@/types";

/**
 * 별자리 배치 (PATH-01). 16차원을 2D로 압축한 **고정 모양**이라 레이어와 무관하다.
 * 같은 곡 집합이면 같은 결과이므로 캐시를 오래 들고 있는다.
 *
 * 좌표를 만드는 곳은 **백엔드 하나뿐이다** (서빙 baseline). 예전에는 프론트가 아는 16차원 좌표를
 * 함께 보냈는데, 그러면 보내는 쪽마다 모양이 달라져 같은 플리를 두 사람이 다르게 본다.
 * 지금은 보내도 백엔드가 무시한다 — 그래서 `musicIds` 만 보낸다 (S15P21A405-278).
 */
export function useConstellationLayoutQuery(musicIds: number[]) {
  // 백엔드가 중복을 거부하고 30곡까지만 받는다. 플리는 그보다 길 수 있어서 여기서 맞춰 준다
  const ids = [...new Set(musicIds)].slice(0, CONSTELLATION_MAX_SONGS);
  return useQuery({
    queryKey: QUERY_KEYS.constellation.layout(ids),
    queryFn: () =>
      api<ConstellationLayout>(API_ENDPOINTS.constellation.layout, {
        method: "POST",
        body: JSON.stringify({ musicIds: ids }),
      }),
    enabled: ids.length >= 2,
    staleTime: Infinity,
  });
}
