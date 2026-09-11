import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface RepresentativesResponse {
  layer: number;
  musicIds: number[];
}

/** 레이어별 대표곡 ID (앨범 커버로 띄우는 곡). 레이어마다 다르다 */
export function useRepresentativesQuery(layer: number) {
  return useQuery({
    queryKey: QUERY_KEYS.map.representatives(layer),
    queryFn: () => api<RepresentativesResponse>(API_ENDPOINTS.map.representatives(layer)),
    staleTime: 10 * 60 * 1000,
  });
}
