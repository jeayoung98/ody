import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

/** 튜토리얼 완료 → user.tutorialCompleted 갱신 */
export function useCompleteTutorialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>(API_ENDPOINTS.auth.completeTutorial, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me }),
  });
}
