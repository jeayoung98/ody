"use client";

import { useMutation } from "@tanstack/react-query";
import { SURVEY_API } from "@/constants/survey";
import { api } from "@/lib/api";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveySubmission } from "@/types/survey";

/** No hidden retries. The card preserves the answer and offers explicit retry. */
export function useSurveySubmit() {
  return useMutation({
    mutationFn: (row: SurveySubmission) => api<{ feedbackId: number }>(SURVEY_API.feedback, {
      method: "POST", body: JSON.stringify(row), signal: AbortSignal.timeout(15_000),
    }),
    retry: false,
    onSuccess: (_, row) => useSurveyStore.getState().finishSubmission(row, true),
    onError: (_, row) => useSurveyStore.getState().finishSubmission(row, false),
  });
}
