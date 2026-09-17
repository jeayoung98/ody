import { analyticsContext, analyticsId, setAnalyticsContext, track, trackOnce } from "./client";
import type { AnalyticsProps } from "@/types/analytics";

let journey: { id: string; start: number; end: number; at: number; settled: boolean } | undefined;
export function requestJourney(start: number, end: number): void {
  journey = { id: analyticsId(), start, end, at: performance.now(), settled: false };
  setAnalyticsContext({ journey_id: journey.id });
  track("journey_create_requested", { start_music_id: start, end_music_id: end });
}
export function journeyResult(start: number, end: number, outcome: "success" | "empty" | "error", count: number): void {
  if (!journey || journey.start !== start || journey.end !== end || journey.settled) return;
  journey.settled = true;
  track("journey_create_result", { journey_id: journey.id, outcome, result_count: count, elapsed_ms: Math.round(performance.now() - journey.at) });
}
export function nearbyResults(center: number, count: number): void {
  const id = analyticsContext().nearby_id;
  if (id) trackOnce(`nearby-results:${id}:${center}`, "nearby_results_viewed", { center_music_id: center, result_count: count });
}

/** UI 표시 효과용. 닫았다가 다시 열면 새 노출, StrictMode 효과 재실행은 같은 노출. */
export function exposure(name: "music_detail_viewed" | "journey_results_viewed", key: string, props: AnalyticsProps): void {
  trackOnce(`${name}:${key}`, name, props);
}
