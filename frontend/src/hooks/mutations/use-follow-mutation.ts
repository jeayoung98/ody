import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

/** 따라가기 시작 */
export function useStartFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api<{ ok: boolean }>(API_ENDPOINTS.user.follow(email), { method: "POST" }),
    onSuccess: (_d, email) => qc.invalidateQueries({ queryKey: QUERY_KEYS.user.profile(email) }),
  });
}

/** 따라가기 해제(하차) */
export function useStopFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api<{ ok: boolean }>(API_ENDPOINTS.user.follow(email), { method: "DELETE" }),
    onSuccess: (_d, email) => qc.invalidateQueries({ queryKey: QUERY_KEYS.user.profile(email) }),
  });
}
