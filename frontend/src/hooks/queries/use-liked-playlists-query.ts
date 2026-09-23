import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistSummary } from "@/types";

/**
 * 좋아요한 플레이리스트. **이메일을 주면 그 사람이 좋아요한 것**이다 (S15P21A405-587).
 * 안 주면 내가 좋아요한 것이다.
 */
export function useLikedPlaylistsQuery(email?: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.playlist.liked(email ?? null),
    queryFn: () => api<PlaylistSummary[]>(API_ENDPOINTS.playlist.liked(email)),
  });
}
