import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

export function useDeletePlaylistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: number) => api<{ ok: boolean }>(API_ENDPOINTS.playlist.detail(playlistId), { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.all }),
  });
}
