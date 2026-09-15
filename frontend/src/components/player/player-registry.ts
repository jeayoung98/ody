/**
 * 지금 소리를 내고 있는 YouTube IFrame Player 싱글턴 레지스트리 (S15P21A405-334).
 *
 * 지도의 [`engine-registry`](../map/engine/engine-registry.ts) 와 같은 모양이다. 플레이어는
 * `youtube-embed` 이 만들고, **진행 바처럼 재생 시계가 필요한 쪽**이 여기서 꺼내 쓴다.
 * 스토어에 넣지 않는 이유: 재생 위치는 초당 여러 번 바뀌는 값이라 전역 상태로 두면 앱 전체가
 * 매 틱 리렌더된다. 읽는 쪽이 자기 주기로 물어보게 둔다.
 */

/** 진행 바가 쓰는 만큼만 (IFrame Player API) */
export interface PlayerHandle {
  getCurrentTime: () => number;
  getDuration: () => number;
  /** allowSeekAhead=true 면 아직 안 받은 구간도 새로 요청한다 — 사용자가 끌어 놓은 자리로 가야 한다 */
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
}

let player: PlayerHandle | null = null;

export function registerPlayer(p: PlayerHandle | null) {
  player = p;
}

export function getPlayer(): PlayerHandle | null {
  return player;
}
