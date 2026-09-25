import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistSummary } from "@/types";

export function useDeletePlaylistMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (playlistId: number) => api<{ ok: boolean }>(API_ENDPOINTS.playlist.detail(playlistId), { method: "DELETE" }),
    onSuccess: (_data, playlistId) => {
      // 무효화 전에 이름을 건진다 — 그 뒤엔 목록에서 사라진다
      const name = qc.getQueryData<PlaylistSummary[]>(QUERY_KEYS.playlist.mine(null))?.find((p) => p.id === playlistId)?.playlistName ?? null;
      showToast(CHANGED.playlistDeleted(name));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.all });
    },
  });
}
