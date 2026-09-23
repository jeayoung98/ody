import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface Input {
  contestId: number;
  entryId: number;
}

/** 출품작을 내 플레이리스트로 복사한다 (곡 순서 유지). 내 플리 목록도 바뀐다 */
export function useSaveContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contestId, entryId }: Input) =>
      api<{ playlistId: number | null; saveCount: number }>(API_ENDPOINTS.contest.save(contestId, entryId), { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
