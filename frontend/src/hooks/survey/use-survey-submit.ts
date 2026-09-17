"use client";

import { useMutation } from "@tanstack/react-query";
import { SURVEY_API } from "@/constants/survey";
import { api } from "@/lib/api";
import { useSurveyStore } from "@/stores/use-survey-store";
import type { SurveySubmission } from "@/types/survey";
import { analyticsId, track } from "@/lib/analytics/client";

/** No hidden retries. The card preserves the answer and offers explicit retry. */
export function useSurveySubmit() {
  return useMutation({
    onMutate: (row) => {
      const properties = { submission_id: analyticsId(), feedback_session_id: row.sessionId, survey_mode: row.mode,
        music_id: row.musicId, rank: row.rank, verdict: row.verdict, reason: row.reason };
      track("survey_submit_requested", properties);
      return properties;
    },
    mutationFn: (row: SurveySubmission) => api<{ feedbackId: number }>(SURVEY_API.feedback, {
      method: "POST", body: JSON.stringify(row), signal: AbortSignal.timeout(15_000),
    }),
    retry: false,
    onSuccess: (data, row, properties) => {
      track("survey_submit_result", { ...properties, outcome: data.feedbackId === 0 ? "mock" : "success" });
      useSurveyStore.getState().finishSubmission(row, true);
    },
    onError: (_, row, properties) => {
      track("survey_submit_result", { ...properties, outcome: "error" });
      useSurveyStore.getState().finishSubmission(row, false);
    },
  });
}
