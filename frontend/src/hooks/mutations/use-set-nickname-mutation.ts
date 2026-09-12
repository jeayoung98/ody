import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";

/** 가입 직후 닉네임 확정 (AUTH-01). 성공하면 내 정보를 다시 읽어 가드가 통과된다 */
export function useSetNicknameMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) =>
      api<{ nickname: string }>(API_ENDPOINTS.auth.nickname, { method: "PATCH", body: JSON.stringify({ nickname: nickname.trim() }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me }),
  });
}
