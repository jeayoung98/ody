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

/**
 * 플레이어가 **"재생 중"을 보고했을 때** 할 일 (S15P21A405-372).
 *
 * 세 갈래를 한 줄로 섞어 놨다가 사고가 났다. 예전 코드는
 * `if (!isPlaying || busy) pauseVideo()` 였는데, **"우리가 멈춘 상태"** 와
 * **"묻는 동안"** 은 전혀 다른 상황인데도 똑같이 소리를 끊었다. 그래서 설문 카드가
 * 뜨는 순간 소리가 통째로 사라졌고, 사용자는 듣지도 못한 곡을 두고 답해야 했다.
 *
 * `busy` 가 필요한 이유는 **청취로 세지 않기 위해서**지 멈추기 위해서가 아니다.
 * 이름을 붙여 갈라 두면 그 둘이 다시 붙지 않는다.
 */
export type PlayingAction =
  /** 우리는 멈춘 상태인데 소리가 나고 있다 — 멈춘다 */
  | "stop"
  /** 답을 강제하는 창이 떠 있다 — 소리는 그대로 두고 청취로는 세지 않는다 */
  | "silent"
  /** 평소 — 청취로 센다 */
  | "count";

export function playingAction(isPlaying: boolean, busy: boolean): PlayingAction {
  if (!isPlaying) return "stop";
  return busy ? "silent" : "count";
}
