/** 전송 주기와 수집 정책. 프레임/재생 진행률은 이벤트가 아니다. */
export const ANALYTICS = {
  checkpointMs: 120_000,
  searchSettleMs: 500,
  wheelSettleMs: 300,
  hoverMs: 500,
  qualifiedMs: 20_000,
  startTimeoutMs: 15_000,
  queueLimit: 100,
  schemaVersion: 1,
} as const;

/** core로 줄여도 이탈 퍼널과 실제 청취/체류 합계는 유지한다. */
export const POSTHOG_CORE_EVENTS = new Set([
  "page_view", "page_leave", "free_explore_started", "tutorial_started", "tutorial_finished",
  "nearby_opened", "nearby_closed", "nearby_results_viewed",
  "journey_create_requested", "journey_create_result", "journey_results_viewed",
  "play_requested", "play_started", "play_qualified", "play_ended", "playback_issue",
  "engagement_recorded", "survey_shown", "survey_submit_result", "feature_request_failed",
]);
