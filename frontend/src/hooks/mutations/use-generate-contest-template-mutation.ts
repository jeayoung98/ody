import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { ContestMatch, ContestTemplate } from "@/types";

/**
 * AI 추천 모양으로 별자리 만들기 (S15P21A405-595). **내 플레이리스트가 하나 생긴다** — 결과는 스토어의 `match` 로 가고,
 * 출품은 그 플리를 그대로 낸다. 내 플리 목록이 바뀐다.
 */
export function useGenerateContestTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: ContestTemplate) =>
      api<ContestMatch>(API_ENDPOINTS.contest.generate, { method: "POST", body: JSON.stringify({ template: t.name, label: t.label }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.playlist.mineAll }),
  });
}
