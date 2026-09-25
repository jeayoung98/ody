import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import { api } from "@/lib/api";

/**
 * 닉네임 변경 (AUTH-01 · USER-02, S15P21A405-474).
 *
 * 가입 직후 닉네임 확정 화면과 프로필 수정 화면이 같이 쓴다. 예전에는 프로필 이미지와
 * 한 요청으로 보냈는데, 백엔드가 둘을 갈라 놓으면서 이미지는 파일 업로드가 됐다
 * (`useUpdateProfileImageMutation`).
 *
 * 성공하면 내 정보를 다시 읽어 상단 프로필·마이페이지가 곧바로 새 값을 보인다.
 */
export function useUpdateNicknameMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (nickname: string) =>
      api<{ nickname: string }>(API_ENDPOINTS.user.nickname, { method: "PATCH", body: JSON.stringify({ nickname }) }),
    onSuccess: (data) => {
      showToast(CHANGED.nicknameChanged(data.nickname));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
