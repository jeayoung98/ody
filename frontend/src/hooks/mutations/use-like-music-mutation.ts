import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, CHANGED, LIKE_FAILED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { MusicDetail } from "@/types";

interface Input {
  musicId: number;
  /** 목표 상태. 토글이 아니다 — 같은 요청을 두 번 보내도 결과가 같다 */
  liked: boolean;
}

/**
 * 곡 좋아요 (S15P21A405-611) — `POST /api/music/like`.
 *
 * **먼저 켜고 나중에 확인한다.** 상세 쿼리는 세션 동안 다시 받지 않으므로(`use-music-detail-query`) 캐시의
 * `liked` 를 바로 바꾼다. 실패하면 되돌리고 토스트로 알린다. 좋아요 수는 상세 응답에 없어 다루지 않는다.
 */
export function useLikeMusicMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  const setLiked = (musicId: number, liked: boolean) =>
    qc.setQueryData<MusicDetail>(QUERY_KEYS.music.detail(musicId), (prev) => (prev ? { ...prev, liked } : prev));

  return useMutation({
    mutationFn: (body: Input) => api<{ liked: boolean }>(API_ENDPOINTS.music.like, { method: "POST", body: JSON.stringify(body) }),
    onMutate: ({ musicId, liked }) => setLiked(musicId, liked),
    onSuccess: (data, { musicId }) => {
      setLiked(musicId, data.liked);
      showToast(data.liked ? CHANGED.musicLiked : CHANGED.musicUnliked);
    },
    onError: (_e, { musicId, liked }) => {
      setLiked(musicId, !liked);
      showToast(LIKE_FAILED);
    },
  });
}
