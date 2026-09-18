import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api";

export interface ProfilePatch {
  nickname?: string;
  /** 빈 문자열이면 지운다. 파일 업로드는 백엔드에 아직 없다 (S15P21A405-426) — 주소만 받는다 */
  imageUrl?: string | null;
}

/**
 * 프로필 부분 수정 (AUTH-01 · USER-02). 가입 직후 닉네임 확정과 프로필 수정 화면이 같이 쓴다 —
 * 백엔드가 둘을 같은 엔드포인트로 받는다 (BACKEND-NOTES A-13).
 * 성공하면 내 정보를 다시 읽어 상단 프로필·마이페이지가 곧바로 새 값을 보인다.
 */
export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) =>
      api<{ nickname: string; imageUrl: string | null }>(API_ENDPOINTS.user.profile, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
