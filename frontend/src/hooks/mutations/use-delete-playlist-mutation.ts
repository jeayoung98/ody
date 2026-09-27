import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGE_FAILED, CHANGED, QUERY_KEYS } from "@/constants";
import { withoutPlaylist } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistSummary } from "@/types";

/**
 * 플리 삭제. **누르는 순간 목록에서 빠진다** (S15P21A405-675) — 응답을 기다리면 ✕ 를 눌렀는데 줄이 그대로라
 * 한 번 더 누르게 된다. 이름은 빼기 전에 건져 둔다. 실패하면 줄을 되돌리고 토스트로 알린다.
 */
export function useDeletePlaylistMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (playlistId: number) => api<{ ok: boolean }>(API_ENDPOINTS.playlist.detail(playlistId), { method: "DELETE" }),
    onMutate: async (playlistId) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.playlist.mineAll, QUERY_KEYS.playlist.likedAll]);
      const name =
        qc
          .getQueriesData<PlaylistSummary[]>({ queryKey: QUERY_KEYS.playlist.mineAll })
          .flatMap(([, list]) => list ?? [])
          .find((p) => p.id === playlistId)?.playlistName ?? null;
      // 내 목록에서도, 누군가의 "좋아요한 플리" 에서도 사라진다 — 지운 플리는 어디에도 없다
      qc.setQueriesData<PlaylistSummary[]>({ queryKey: QUERY_KEYS.playlist.mineAll }, (prev) => withoutPlaylist(prev, playlistId));
      qc.setQueriesData<PlaylistSummary[]>({ queryKey: QUERY_KEYS.playlist.likedAll }, (prev) => withoutPlaylist(prev, playlistId));
      return { restore, name };
    },
    onError: (_e, _id, ctx) => {
      ctx?.restore();
      showToast(CHANGE_FAILED);
    },
    onSuccess: (_data, _playlistId, ctx) => {
      showToast(CHANGED.playlistDeleted(ctx?.name ?? null));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.all });
    },
  });
}
