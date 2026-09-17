import { ANALYTICS } from "@/constants/analytics";
import { analyticsContext, onAnalyticsContextChange, track } from "./client";

/** 구간 차분만 반환한다. 종료할 때 누적 합계를 다시 보내지 않는다. */
export class EngagementClock {
  private at: number;
  constructor(now: number) { this.at = now; }
  take(now: number, visible: boolean, playing: boolean, blocked: boolean, survey: boolean) {
    const elapsed = Math.max(0, now - this.at);
    this.at = now;
    return {
      foreground_ms: visible ? Math.round(elapsed) : 0,
      explore_ms: visible && !blocked ? Math.round(elapsed) : 0,
      playback_ms: playing ? Math.round(elapsed) : 0,
      survey_ms: visible && survey ? Math.round(elapsed) : 0,
    };
  }
}

let clock: EngagementClock | undefined;
let visible = true;
let playing = false;
let suspended = false;
export function flushEngagement(reason: string): void {
  if (!clock) return;
  const c = analyticsContext();
  const blocked = !!c.blocked || !!c.help_open || c.phase === "guide" || c.phase === "loading";
  const delta = clock.take(performance.now(), visible && !suspended, playing && !suspended, blocked, !!c.survey_open);
  if (Object.values(delta).some((n) => n > 0)) track("engagement_recorded", { ...delta, reason });
}
export function setActualPlaying(next: boolean): void {
  if (playing === next) return;
  flushEngagement("playback_state");
  playing = next;
}
export function startEngagement(): void {
  if (clock) return;
  clock = new EngagementClock(performance.now());
  visible = document.visibilityState === "visible";
  onAnalyticsContextChange(() => flushEngagement("context_change"));
  document.addEventListener("visibilitychange", () => {
    flushEngagement("visibility");
    visible = document.visibilityState === "visible";
  });
  window.addEventListener("pagehide", () => { flushEngagement("pagehide"); suspended = true; });
  window.addEventListener("pageshow", () => { clock?.take(performance.now(), false, false, false, false); suspended = false; });
  window.setInterval(() => flushEngagement("checkpoint"), ANALYTICS.checkpointMs);
}
