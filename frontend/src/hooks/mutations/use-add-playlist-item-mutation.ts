import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

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
  return useMutation({
    mutationFn: ({ playlistId, musicId }: Input) =>
      api<InsertResult>(API_ENDPOINTS.playlist.items(playlistId), { method: "POST", body: JSON.stringify({ musicId }) }),
    onSuccess: (_data, { playlistId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mine });
    },
  });
}
