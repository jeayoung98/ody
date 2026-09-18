import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";

/** 공개 계정 여부 (USER-02). 비공개면 남이 내 프로필을 열거나 따라갈 수 없다 */
export function useUpdateVisibilityMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isPublic: boolean) =>
      api<{ isPublic: boolean }>(API_ENDPOINTS.user.publicVisibility, { method: "PATCH", body: JSON.stringify({ isPublic }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
