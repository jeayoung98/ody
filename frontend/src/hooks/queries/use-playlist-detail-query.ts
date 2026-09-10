import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistDetail } from "@/types";

export function usePlaylistDetailQuery(playlistId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.playlist.detail(playlistId ?? -1),
    queryFn: () => api<PlaylistDetail>(API_ENDPOINTS.playlist.detail(playlistId!)),
    enabled: playlistId != null,
  });
}
