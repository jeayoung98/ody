import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface Input {
  playlistName: string;
  /** 작품 곡 순서 그대로 */
  musicIds: number[];
}

/** 작품을 내 플레이리스트로 복사한다 (S15P21A405-640). 내 플리 목록이 바뀐다 */
export function useSaveContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Input) => api<{ playlistId: number }>(API_ENDPOINTS.contest.save, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll }),
  });
}
