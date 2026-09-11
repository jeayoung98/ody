import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, STORAGE_KEYS } from "@/constants";
import { api } from "@/lib/api";
import { writeStorage } from "@/lib/storage";

interface ExchangeResponse {
  accessToken: string;
}

/**
 * OAuth 콜백 code → accessToken 교환 (AUTH-02).
 * refresh token 은 백엔드가 httpOnly 쿠키로 이미 심어놨으므로 프론트는 건드리지 않는다
 * (fetch 의 credentials: "include" 로 브라우저가 알아서 붙인다).
 */
export function useExchangeCodeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<ExchangeResponse>(API_ENDPOINTS.auth.exchange, { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: ({ accessToken }) => {
      writeStorage(STORAGE_KEYS.accessToken, accessToken);
      // 토큰이 생겼으니 토큰 없이 실패했던 조회들을 다시 태운다
      qc.clear();
    },
  });
}
