import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGE_FAILED, CHANGED, QUERY_KEYS } from "@/constants";
import { withItemCount, withPlaylistItem } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import { useToastStore } from "@/stores/use-toast-store";
import type { MusicDetail, PlaylistDetail, PlaylistSummary } from "@/types";

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

/**
 * 플리에 곡 담기. **누르는 순간 곡 수가 오르고, 상세가 떠 있으면 줄도 붙는다** (S15P21A405-675).
 *
 * 곡 정보는 곡 상세 캐시에서 가져온다 — 담기 메뉴는 곡 상세 패널에서 열리므로 대개 있다. 없으면 줄은
 * 못 붙이고 곡 수만 먼저 올린다. 이미 담긴 곡은 서버가 `skippedCnt` 로 거르는데, 그 답이 오면 먼저 올린
 * 것을 되돌리고 "이미 담긴 곡" 토스트를 띄운다. 상세 캐시에 이미 그 곡이 있으면 애초에 안 움직인다.
 */
export function useAddPlaylistItemMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ playlistId, musicId }: Input) =>
      api<InsertResult>(API_ENDPOINTS.playlist.items(playlistId), { method: "POST", body: JSON.stringify({ musicId }) }),
    onMutate: async ({ playlistId, musicId }) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.playlist.detail(playlistId), QUERY_KEYS.playlist.mineAll]);
      const detail = qc.getQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId));
      const known = detail?.items.some((it) => it.musicId === musicId) ?? false;
      if (!known) {
        const music = qc.getQueryData<MusicDetail>(QUERY_KEYS.music.detail(musicId));
        qc.setQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId), (prev) => withPlaylistItem(prev, music));
        qc.setQueriesData<PlaylistSummary[]>({ queryKey: QUERY_KEYS.playlist.mineAll }, (prev) => withItemCount(prev, playlistId, 1));
      }
      return restore;
    },
    onError: (_e, _input, restore) => {
      restore?.();
      showToast(CHANGE_FAILED);
    },
    onSuccess: (data, { playlistId }, restore) => {
      // 이름은 내 플리 목록 캐시에서 — 메뉴가 그 목록을 그리고 있으니 대개 있다 (S15P21A405-667)
      const name = qc.getQueryData<PlaylistSummary[]>(QUERY_KEYS.playlist.mine(null))?.find((p) => p.id === playlistId)?.playlistName ?? null;
      const duplicate = data.insertedCnt === 0 && data.skippedCnt > 0;
      if (duplicate) restore?.();
      showToast(duplicate ? CHANGED.playlistItemDuplicate : CHANGED.playlistItemAdded(name));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
