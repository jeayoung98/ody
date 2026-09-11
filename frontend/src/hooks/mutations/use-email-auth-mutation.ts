import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, STORAGE_KEYS } from "@/constants";
import { api } from "@/lib/api";
import { writeStorage } from "@/lib/storage";

interface Credentials {
  email: string;
  password: string;
  /** 가입에만 있다 — 백엔드가 가입 요청에서 닉네임까지 함께 받는다 (S15P21A405-121) */
  nickname?: string;
  /** 로그인 상태 유지 (끄면 이 탭에서만 유지) */
  remember?: boolean;
}

interface TokenResponse {
  accessToken: string;
}

/**
 * 이메일·비밀번호 가입/로그인 (AUTH-01/02). 두 경로가 같은 응답(accessToken)을 준다.
 * refresh token 은 백엔드가 httpOnly 쿠키로 심는다 — 프론트는 건드리지 않는다.
 */
function useTokenMutation(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password, nickname }: Credentials) =>
      api<TokenResponse>(path, {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, ...(nickname ? { nickname: nickname.trim() } : {}) }),
      }),
    onSuccess: ({ accessToken }, { remember = true }) => {
      writeStorage(STORAGE_KEYS.accessToken, accessToken, remember ? "local" : "session");
      // 토큰이 생겼으니 토큰 없이 받아둔 응답은 버린다
      qc.clear();
    },
  });
}

export const useSignupMutation = () => useTokenMutation(API_ENDPOINTS.auth.signup);
export const useLoginMutation = () => useTokenMutation(API_ENDPOINTS.auth.login);
