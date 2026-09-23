import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistDetail } from "@/types";

export function useCreatePlaylistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistName: string) =>
      api<PlaylistDetail>(API_ENDPOINTS.playlist.list, { method: "POST", body: JSON.stringify({ playlistName }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll }),
  });
}
