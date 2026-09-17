import { ANALYTICS } from "@/constants/analytics";
import type { AnalyticsEventName, AnalyticsProps } from "@/types/analytics";
import { analyticsContext, analyticsId, track } from "./client";
import { setActualPlaying } from "./engagement";

type Emit = (name: AnalyticsEventName, props: AnalyticsProps) => void;
/** YouTube PLAYING 구간의 벽시계만 누적한다. seek 위치나 낙관적 isPlaying은 청취 시간이 아니다. */
export class PlaybackMeter {
  private state = -1;
  private at = 0;
  private listened = 0;
  private started = false;
  private qualified = false;
  private active = false;
  private props: AnalyticsProps = {};
  constructor(private emit: Emit, private now: () => number = () => performance.now()) {}
  begin(props: AnalyticsProps): void {
    this.end("replaced");
    this.props = props;
    this.state = -1;
    this.listened = 0;
    this.started = false;
    this.qualified = false;
    this.active = true;
    this.at = this.now();
    this.emit("play_requested", props);
  }
  private accrue(): void {
    const now = this.now();
    if (this.active && this.state === 1) this.listened += Math.max(0, now - this.at);
    this.at = now;
    if (this.active && !this.qualified && this.listened >= ANALYTICS.qualifiedMs) {
      this.qualified = true;
      this.emit("play_qualified", { ...this.props, listened_ms: Math.round(this.listened) });
    }
  }
  change(state: number): void {
    if (!this.active) return;
    this.accrue();
    const previous = this.state;
    this.state = state;
    if (state === 1 && !this.started) { this.started = true; this.emit("play_started", this.props); }
    else if (state === 1 && previous === 2) this.emit("play_resumed", this.props);
    else if (state === 2 && this.started && previous !== 2) this.emit("play_paused", this.props);
    if (state === 0) this.end("completed");
  }
  checkpoint(): void { this.accrue(); }
  remaining(): number { return this.qualified || !this.active || this.state !== 1 ? 0 : Math.max(1, ANALYTICS.qualifiedMs - this.listened); }
  hasStarted(): boolean { return this.started; }
  isActive(): boolean { return this.active; }
  properties(): AnalyticsProps { return { ...this.props }; }
  end(reason: string): void {
    if (!this.active) return;
    this.accrue();
    this.active = false;
    this.emit("play_ended", { ...this.props, reason, started: this.started, listened_ms: Math.round(this.listened) });
  }
}

export const playbackMeter = new PlaybackMeter(track);
let musicId: number | null = null;
let qualifyTimer: ReturnType<typeof setTimeout> | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
const issues = new Set<string>();

export function requestPlayback(id: number, props: AnalyticsProps): void {
  clearTimeout(timeout);
  clearTimeout(qualifyTimer);
  setActualPlaying(false);
  musicId = id;
  issues.clear();
  playbackMeter.begin({ ...analyticsContext(), ...props, music_id: id, playback_id: analyticsId() });
  timeout = setTimeout(() => {
    if (!playbackMeter.hasStarted()) playbackIssue("start_unconfirmed");
  }, ANALYTICS.startTimeoutMs);
}
export function playbackIssue(reason: string, code?: number): void {
  if (!playbackMeter.isActive() || issues.has(reason)) return;
  issues.add(reason);
  track("playback_issue", { ...playbackMeter.properties(), reason, code });
}
export function reportActualPlayback(id: number, state: "playing" | "paused" | "ended" | "unavailable"): void {
  if (id !== musicId || !playbackMeter.isActive()) return;
  if (state === "unavailable") {
    playbackIssue("no_video");
    endPlayback("unavailable");
    return;
  }
  if (state === "ended") {
    playbackMeter.change(0);
    setActualPlaying(false);
    return;
  }
  if (state === "playing") clearTimeout(timeout);
  playbackMeter.change(state === "playing" ? 1 : 2);
  setActualPlaying(state === "playing");
  clearTimeout(qualifyTimer);
  const remaining = playbackMeter.remaining();
  if (remaining) qualifyTimer = setTimeout(() => playbackMeter.checkpoint(), remaining);
}
export function endPlayback(reason: string): void {
  clearTimeout(qualifyTimer);
  clearTimeout(timeout);
  playbackMeter.end(reason);
  setActualPlaying(false);
}
