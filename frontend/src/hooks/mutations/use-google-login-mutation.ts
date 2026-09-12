import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, STORAGE_KEYS } from "@/constants";
import { api } from "@/lib/api";
import { writeStorage } from "@/lib/storage";
import type { Email } from "@/types";

/** `POST /api/auth/login/google` 응답 (백엔드 `GoogleLoginResponseDto`). refresh 는 httpOnly 쿠키로 온다 */
interface GoogleLoginResponse {
  accessToken: string;
  /** 백엔드 `GoogleLoginResult.UserInfo` — `User` 전체가 아니라 이 네 필드만 온다 */
  user: { email: Email; name: string | null; nickname: string | null; imageUrl: string | null };
}

/**
 * 구글 로그인 (AUTH-01/02). Google Identity Services 가 발급한 idToken 을 백엔드가 검증한다.
 * 응답에 사용자가 함께 오므로 본인 조회(`/bff/auth/me`, 백엔드 미구현 — BACKEND-NOTES A-15) 없이도
 * 신규 여부를 알 수 있다: `nickname` 이 비어 있으면 닉네임 설정이 필요한 신규 사용자다 (A-14).
 */
export function useGoogleLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idToken: string) =>
      api<GoogleLoginResponse>(API_ENDPOINTS.auth.googleLogin, { method: "POST", body: JSON.stringify({ idToken }) }),
    onSuccess: ({ accessToken }) => {
      writeStorage(STORAGE_KEYS.accessToken, accessToken);
      // 토큰이 생겼으니 토큰 없이 실패했던 조회들을 다시 태운다
      qc.clear();
    },
  });
}
