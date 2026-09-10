import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface LikeResponse {
  isLiked: boolean;
  likeCnt: number;
}

/** 좋아요 토글 (저장됨) */
export function useLikePlaylistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: number) => api<LikeResponse>(API_ENDPOINTS.playlist.like(playlistId), { method: "POST" }),
    onSuccess: (_data, playlistId) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.detail(playlistId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.liked });
    },
  });
}
