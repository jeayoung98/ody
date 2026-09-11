import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

/**
 * 튜토리얼 완료 → `user.tutorial_completed` 갱신 (AUTH-04).
 * 백엔드는 PATCH 이고 본문을 받지 않는다 — 토큰 주체 본인만 대상이라 email 을 넘기지 않는다.
 */
export function useCompleteTutorialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ tutorialCompleted: boolean }>(API_ENDPOINTS.user.completeTutorial, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me }),
  });
}
