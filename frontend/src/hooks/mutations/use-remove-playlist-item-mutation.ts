import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistDetail } from "@/types";

interface Input {
  playlistId: number;
  musicId: number;
}

export function useRemovePlaylistItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, musicId }: Input) =>
      api<PlaylistDetail>(API_ENDPOINTS.playlist.item(playlistId, musicId), { method: "DELETE" }),
    onSuccess: (_data, { playlistId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mine });
    },
  });
}
