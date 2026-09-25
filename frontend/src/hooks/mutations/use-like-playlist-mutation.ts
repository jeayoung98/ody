import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGED, LIKE_FAILED, QUERY_KEYS } from "@/constants";
import { withLikedPlaylist, withPlaylistLike } from "@/lib/optimistic";
import { snapshotQueries } from "@/lib/query-snapshot";
import { useToastStore } from "@/stores/use-toast-store";
import type { PlaylistDetail, PlaylistSummary, User } from "@/types";

interface LikeResponse {
  isLiked: boolean;
  /** **변경 후** 값이다 — 다시 조회하지 않고 바로 화면에 쓴다 */
  likeCnt: number;
}

/**
 * 플레이리스트 좋아요 (S15P21A405-492, BACKEND-NOTES A-41). **실연동이다** — 예전에는 501 이었다.
 *
 * **토글이 아니라 목표 상태를 보낸다.** 화면이 "지금 안 눌려 있으니 `liked: true`" 를 정해서
 * 보낸다 — 서버가 뒤집는 방식이면 요청이 두 번 나갔을 때 원래대로 돌아와 버린다. 목표 상태로
 * 보내면 같은 요청을 반복해도 결과가 같다.
 *
 * 응답으로 화면을 **바로** 갱신한다. 무효화만 하고 재조회를 기다리면 하트가 한 박자 늦게 켜져서
 * 두 번 누르게 된다. 좋아요한 플리 목록은 여기서 알 수 없으니 그쪽만 무효화한다.
 *
 * **누르는 순간 하트가 켜진다** (S15P21A405-675). 상세의 `isLiked`·수를 먼저 뒤집고, 내 "좋아요한 플리"
 * 목록에서도 빼거나 앞에 세운다. 남의 좋아요 목록(`liked(남의 이메일)`)은 건드리지 않는다 — 그건 그 사람 것이다.
 */
export function useLikePlaylistMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ playlistId, liked }: { playlistId: number; liked: boolean }) =>
      api<LikeResponse>(API_ENDPOINTS.playlist.like(playlistId), { method: "POST", body: JSON.stringify({ liked }) }),
    onMutate: async ({ playlistId, liked }) => {
      const restore = await snapshotQueries(qc, [QUERY_KEYS.playlist.detail(playlistId), QUERY_KEYS.playlist.likedAll]);
      const detail = qc.getQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId));
      qc.setQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId), (prev) => withPlaylistLike(prev, liked));
      const me = qc.getQueryData<User>(QUERY_KEYS.auth.me)?.email ?? null;
      for (const email of me ? [null, me] : [null]) {
        qc.setQueryData<PlaylistSummary[]>(QUERY_KEYS.playlist.liked(email), (prev) => withLikedPlaylist(prev, detail, playlistId, liked));
      }
      return restore;
    },
    onError: (_e, _input, restore) => {
      restore?.();
      showToast(LIKE_FAILED);
    },
    onSuccess: (data, { playlistId }) => {
      showToast(data.isLiked ? CHANGED.playlistLiked : CHANGED.playlistUnliked);
      qc.setQueryData<PlaylistDetail>(QUERY_KEYS.playlist.detail(playlistId), (prev) =>
        prev ? { ...prev, isLiked: data.isLiked, likeCnt: data.likeCnt } : prev,
      );
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.likedAll });
    },
  });
}
