import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import { useToastStore } from "@/stores/use-toast-store";
import type { TasteAnalysis } from "@/types";

/**
 * 취향 리포트 만들기 (S15P21A405-630) — `POST /bff/taste-analysis`.
 *
 * 응답이 **조회와 같은 모양**이라 그대로 캐시에 넣는다. 다시 부르지 않아도 화면이 바뀐다.
 *
 * 실패는 **코드마다 할 일이 다르다.** 서버 문구를 그대로 띄우는 이유는 그게 가장 정확하기
 * 때문이다 — 언제 다시 되는지(`nextAvailableAt`)까지 백엔드가 알고 있고, 우리가 옮겨 적으면
 * 둘이 어긋난다. 다만 `TASTE_ANALYSIS_IN_PROGRESS` 만은 다르다: 그건 **실패가 아니라 이미
 * 돌고 있다는 뜻**이라, 알림 대신 조회를 다시 걸어 진행 상태로 넘어가게 둔다.
 */
export function useGenerateTasteAnalysisMutation() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: () => api<TasteAnalysis>(API_ENDPOINTS.taste.analysis, { method: "POST" }),
    onSuccess: (data) => queryClient.setQueryData(QUERY_KEYS.taste.analysis, data),
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "UNKNOWN";
      if (code === "TASTE_ANALYSIS_IN_PROGRESS") {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.taste.analysis });
        return;
      }
      showToast(error instanceof ApiError ? error.message : "취향 리포트를 만들지 못했습니다.");
    },
  });
}
