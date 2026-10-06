import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestArtworkShape } from "@/types";

/**
 * 작품 한 점의 별자리 좌표 (S15P21A405-701). 채점이 끝난 내 작품 카드가 그림을 그리려고 부른다.
 * 출품 뒤 모양은 바뀌지 않으므로 한 번 받으면 다시 안 묻는다. 실패해도 카드의 점수·코멘트는 그대로다.
 */
export function useContestArtworkQuery(artworkId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.contest.detail(artworkId ?? -1),
    queryFn: () => api<ContestArtworkShape>(API_ENDPOINTS.contest.detail(artworkId!)),
    enabled: artworkId != null,
    staleTime: Infinity,
    retry: 1,
  });
}
