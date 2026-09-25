import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGE_FAILED, CHANGED, QUERY_KEYS } from "@/constants";
import { withItemCount, withoutPlaylistItem } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistDetail, PlaylistSummary } from "@/types";

/** 백엔드 `PlaylistMusicDeleteResponse` */
interface DeleteResult {
  playlistId: number;
  deletedCnt: number;
  musicCnt: number;
}

interface Input {
  playlistId: number;
  musicId: number;
}

/** 누르는 순간 줄이 빠지고 곡 수가 준다 (S15P21A405-675). 실패하면 되돌리고 토스트 */
export function useRemovePlaylistItemMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ playlistId, musicId }: Input) =>
      api<DeleteResult>(API_ENDPOINTS.playlist.item(playlistId, musicId), { method: "DELETE" }),
    onMutate: async ({ playlistId, musicId }) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.playlist.detail(playlistId), QUERY_KEYS.playlist.mineAll]);
      qc.setQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId), (prev) => withoutPlaylistItem(prev, musicId));
      qc.setQueriesData<PlaylistSummary[]>({ queryKey: QUERY_KEYS.playlist.mineAll }, (prev) => withItemCount(prev, playlistId, -1));
      return restore;
    },
    onError: (_e, _input, restore) => {
      restore?.();
      showToast(CHANGE_FAILED);
    },
    onSuccess: (_data, { playlistId }) => {
      showToast(CHANGED.playlistItemRemoved);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
