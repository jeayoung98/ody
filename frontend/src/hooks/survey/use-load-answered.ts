"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SURVEY_API, SURVEY_QUERY_KEYS } from "@/constants/survey";
import { getAnonymousId } from "@/lib/anonymous-id";
import { api } from "@/lib/api";
import { useSurveyStore } from "@/stores/use-survey-store";
import { questionKey, type AnsweredRow } from "@/types/survey";

export function useLoadAnswered() {
  const { data, error } = useQuery({
    queryKey: SURVEY_QUERY_KEYS.answered,
    queryFn: async () => (await api<AnsweredRow[]>(`${SURVEY_API.answered}?anonymousId=${encodeURIComponent(getAnonymousId())}`,
      { signal: AbortSignal.timeout(10_000) })).map(questionKey),
    retry: 1, staleTime: Infinity,
  });
  useEffect(() => {
    const s = useSurveyStore.getState();
    if (data) s.loadAnswered(data);
    else s.setHistoryLoading(!error);
  }, [data, error]);
}
