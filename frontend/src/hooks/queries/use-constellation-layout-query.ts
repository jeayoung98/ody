import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";
import type { ConstellationLayout, MapPoint } from "@/types";

/**
 * 별자리 배치 (PATH-01). 16차원을 2D로 압축한 **고정 모양**이라 레이어와 무관하다.
 * 같은 곡 집합이면 같은 결과이므로 캐시를 오래 들고 있는다.
 *
 * `points` 는 그 곡들의 16차원 좌표다. 지금 배치를 만드는 쪽이 목이라 **서버가 모르는 곡**
 * (배포 백엔드에서 온 여정 경로 곡)은 좌표를 못 찾아 전부 (0,0) 으로 눌린다 — 한 덩어리로 뭉쳐 보이는
 * 이유가 이것이다. 그래서 아는 좌표를 함께 보낸다. 백엔드가 A-9 를 구현하면 이 필드는 무시하면 된다.
 */
export function useConstellationLayoutQuery(musicIds: number[], points: MapPoint[] = []) {
  return useQuery({
    queryKey: QUERY_KEYS.constellation.layout(musicIds),
    queryFn: () =>
      api<ConstellationLayout>(API_ENDPOINTS.constellation.layout, {
        method: "POST",
        body: JSON.stringify({ musicIds, points: points.map((p) => ({ musicId: p.musicId, pc: p.pc })) }),
      }),
    enabled: musicIds.length >= 2,
    staleTime: Infinity,
  });
}
