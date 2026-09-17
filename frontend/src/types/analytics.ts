export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;
export type PostHogMode = "all" | "core" | "off";
export interface AnalyticsConfig {
  dataSource: "live" | "mock";
  gaId: string;
  posthogKey: string;
  posthogHost: string;
  posthogMode: PostHogMode;
  replay: boolean;
  release: string;
  testPhase: string;
}
export type AnalyticsEventName =
  | "page_view" | "page_leave" | "free_explore_started" | "engagement_recorded"
  | "test_guide_viewed" | "test_guide_accepted" | "tutorial_started" | "tutorial_step_viewed" | "tutorial_step_completed" | "tutorial_finished"
  /** 발견 힌트 (S15P21A405-393). 튜토리얼과 별개로, 문맥마다 한 번 짚어 주는 자리 */
  | "play_hint_shown" | "play_hint_done"
  | "map_ready" | "map_pan_completed" | "map_zoom_completed" | "map_layer_changed" | "map_locate_used"
  | "music_clicked" | "music_detail_viewed"
  | "search_opened" | "search_executed" | "search_results_viewed" | "search_result_selected" | "search_more_requested" | "search_closed"
  | "nearby_opened" | "nearby_center_changed" | "nearby_results_viewed" | "nearby_closed"
  | "journey_composer_opened" | "journey_composer_closed" | "journey_endpoint_changed" | "journey_endpoints_swapped"
  | "journey_create_requested" | "journey_create_result" | "journey_results_viewed" | "journey_cleared"
  | "queue_play_requested" | "play_requested" | "play_started" | "play_paused" | "play_resumed" | "play_seeked"
  | "play_next_requested" | "play_prev_requested" | "play_qualified" | "play_ended" | "playback_issue"
  | "panel_changed" | "panel_collapsed_changed" | "view_mode_changed" | "help_opened" | "help_closed"
  | "activity_switch_prompted" | "activity_switch_decided" | "action_blocked" | "feature_request_failed";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties: AnalyticsProps;
  timestamp: number;
}
