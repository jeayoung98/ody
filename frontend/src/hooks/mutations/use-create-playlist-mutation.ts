import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistDetail } from "@/types";

export function useCreatePlaylistMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (playlistName: string) =>
      api<PlaylistDetail>(API_ENDPOINTS.playlist.list, { method: "POST", body: JSON.stringify({ playlistName }) }),
    onSuccess: (created) => {
      showToast(CHANGED.playlistCreated(created.playlistName));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
