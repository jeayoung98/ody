import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistSummary } from "@/types";

/** 백엔드 `PlaylistMusicInsertResponse`. 이미 들어 있던 곡은 `skippedCnt` 로 빠진다 */
interface InsertResult {
  playlistId: number;
  insertedCnt: number;
  skippedCnt: number;
  musicCnt: number;
}

interface Input {
  playlistId: number;
  musicId: number;
}

export function useAddPlaylistItemMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ playlistId, musicId }: Input) =>
      api<InsertResult>(API_ENDPOINTS.playlist.items(playlistId), { method: "POST", body: JSON.stringify({ musicId }) }),
    onSuccess: (data, { playlistId }) => {
      // 이름은 내 플리 목록 캐시에서 — 메뉴가 그 목록을 그리고 있으니 대개 있다 (S15P21A405-667)
      const name = qc.getQueryData<PlaylistSummary[]>(QUERY_KEYS.playlist.mine(null))?.find((p) => p.id === playlistId)?.playlistName ?? null;
      showToast(data.insertedCnt === 0 && data.skippedCnt > 0 ? CHANGED.playlistItemDuplicate : CHANGED.playlistItemAdded(name));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
