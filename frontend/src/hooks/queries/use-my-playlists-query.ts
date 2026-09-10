import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistSummary } from "@/types";

export function useMyPlaylistsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.playlist.mine,
    queryFn: () => api<PlaylistSummary[]>(API_ENDPOINTS.playlist.mine),
  });
}
