import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";

/**
 * 가입 직후 닉네임 확정 (AUTH-01). 성공하면 내 정보를 다시 읽어 가드가 통과된다.
 *
 * 전용 엔드포인트(`PATCH /api/auth/nickname`) 대신 프로필 부분 수정 API 를 쓴다 —
 * 백엔드가 구글 신규 가입자의 빈 nickname 을 채우려고 만든 것이 이쪽이다 (S15P21A405-216).
 * 넘기지 않은 필드는 기존 값을 유지하는 PATCH 시맨틱이다.
 */
export function useSetNicknameMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) =>
      api<{ nickname: string; imageUrl: string | null }>(API_ENDPOINTS.user.profile, {
        method: "PATCH",
        body: JSON.stringify({ nickname: nickname.trim() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me }),
  });
}
