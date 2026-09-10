import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, STORAGE_KEYS } from "@/constants";
import { api } from "@/lib/api";
import { removeStorage } from "@/lib/storage";

export function useLogoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<null>(API_ENDPOINTS.auth.logout, { method: "POST" }),
    // 토큰은 어차피 무효화되므로 로그아웃 요청이 실패해도 로컬에서는 지운다
    onSettled: () => {
      removeStorage(STORAGE_KEYS.accessToken);
      qc.clear();
    },
  });
}
