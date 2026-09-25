import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS, CHANGED, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import { api } from "@/lib/api";

/**
 * 프로필 사진 교체 (USER-02, S15P21A405-474).
 *
 * 백엔드가 **파일만** 받는다 — 주소 문자열을 보내는 길은 없다 (S15P21A405-426).
 * `FormData` 를 그대로 넘기면 `api()` 가 `Content-Type` 을 손대지 않아 경계 문자열이 맞는다.
 *
 * **지우는 길은 없다.** 백엔드에 삭제 API 가 없어서 다른 사진으로 덮는 것만 된다 (A-37).
 */
export function useUpdateProfileImageMutation() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return api<{ imageUrl: string }>(API_ENDPOINTS.user.image, { method: "PATCH", body: form });
    },
    onSuccess: () => {
      showToast(CHANGED.profileImageChanged);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.user.all });
    },
  });
}
