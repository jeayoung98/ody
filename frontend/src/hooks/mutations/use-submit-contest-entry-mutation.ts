import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestSubmitResult } from "@/types";

interface Input {
  title: string;
  /** 매칭 결과 순서 그대로 */
  musicIds: number[];
  closed: boolean;
}

/**
 * 출품 (S15P21A405-640) — BFF 가 플리를 만들고 작품으로 낸다. 내 작품·리더보드(재출품이면 이전 작품이 사라진다)·
 * 내 플리 목록(플리가 하나 생긴다)이 같이 바뀐다.
 */
export function useSubmitContestEntryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Input) => api<ContestSubmitResult>(API_ENDPOINTS.contest.entries, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.contest.all });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll });
    },
  });
}
