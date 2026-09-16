/** Actual transport reports, not optimistic UI intent. No survey dependency. */
export interface PlaybackEvent {
  musicId: number;
  playSeq: number;
  state: "playing" | "paused" | "unavailable";
  at: number;
}

const listeners = new Set<(event: PlaybackEvent) => void>();
export function reportPlayback(event: PlaybackEvent): void {
  listeners.forEach((listener) => listener(event));
}
export function subscribePlayback(listener: (event: PlaybackEvent) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
