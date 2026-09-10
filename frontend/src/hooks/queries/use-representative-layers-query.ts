import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

export interface RepresentativeLayersResponse {
  musicId: number;
  /** 이 곡이 대표곡으로 노출되는 레이어 (오름차순). 여러 레이어에 동시에 있을 수 있다 */
  layers: number[];
}

const options = (musicId: number) => ({
  queryKey: QUERY_KEYS.map.representativeLayers(musicId),
  queryFn: () => api<RepresentativeLayersResponse>(API_ENDPOINTS.map.representativeLayers(musicId)),
  staleTime: 10 * 60 * 1000,
});

/** 이 곡이 대표곡인 레이어 목록 */
export function useRepresentativeLayersQuery(musicId: number | null) {
  return useQuery({ ...options(musicId ?? -1), enabled: musicId != null });
}

/** 클릭 시점에 명령형으로 가져와야 할 때 (검색 결과 클릭 등) */
export function useFetchRepresentativeLayers() {
  const qc = useQueryClient();
  return (musicId: number) => qc.fetchQuery(options(musicId));
}
