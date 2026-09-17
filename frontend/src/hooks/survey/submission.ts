import { getAnonymousId } from "@/lib/anonymous-id";
import { SURVEY_API } from "@/constants/survey";
import type { SurveySubmission, SurveyTarget, SurveyReason } from "@/types/survey";

interface SubmitInput {
  target: SurveyTarget;
  verdict: boolean | null;
  reason: SurveyReason | null;
  listenedMs: number;
  skipped: boolean;
  durationSec?: number | null;
}

const LISTENED_SEC_MAX = 32767;

/** Construct once, then retry this exact payload (including anonymous identity). */
export function buildSubmission(input: SubmitInput): SurveySubmission {
  const cap = input.durationSec != null && input.durationSec > 0 ? Math.min(input.durationSec, LISTENED_SEC_MAX) : LISTENED_SEC_MAX;
  return { ...input.target, anonymousId: getAnonymousId(), verdict: input.verdict,
    reason: input.verdict === false ? input.reason : null,
    listenedSec: Math.min(Math.max(0, Math.floor(input.listenedMs / 1000)), Math.floor(cap)), skipped: input.skipped };
}

/** Best effort only: browsers do not guarantee delivery or receipt on pagehide. */
export function sendUnanswered(input: Omit<SubmitInput, "verdict" | "reason">): void {
  const body = JSON.stringify(buildSubmission({ ...input, verdict: null, reason: null }));
  try {
    if (navigator.sendBeacon?.(SURVEY_API.feedback, new Blob([body], { type: "application/json" }))) return;
  } catch { /* Fall back to keepalive. Neither path implies stored successfully. */ }
  void fetch(SURVEY_API.feedback, {
    method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true,
  }).catch(() => {});
}
