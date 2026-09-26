"use client";

import { REALTIME } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { getPlayer } from "@/components/player/player-registry";
import { sendJoinNow } from "@/hooks/use-presence-join";
import { adjustRiderCount, pushViewport } from "@/hooks/use-viewport-subscription";
import { subscribePlayback } from "@/lib/playback-events";
import { send } from "@/lib/realtime/stomp-client";
import { useFollowStore } from "@/stores/use-follow-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import type { RidePanelTab, RidePlaybackEvent, RidePlaybackState, RideViewRequest } from "@/types";

/**
 * 따라가기의 **플레이어 쪽 배선** (2차 실시간 명세 §4.1·§5.1, S15P21A405-530).
 *
 * 훅이 아니라 모듈인 이유는 부르는 자리가 React 밖이기 때문이다 — 재생바(`player-progress`)의
 * 커밋 함수, 스토어 구독, 소켓 처리기 셋이 같은 함수를 쓴다.
 */

/** 초를 ms 로. 플레이어는 초로 말하고 서버는 ms 로 말한다 */
const toMs = (sec: number) => Math.max(0, Math.round(sec * 1000));

/** 지금 재생 위치(ms). 플레이어가 아직 없으면 0 */
export function currentPositionMs(): number {
  const p = getPlayer();
  if (!p) return 0;
  const t = p.getCurrentTime();
  return Number.isFinite(t) ? toMs(t) : 0;
}

// ── 따라가는 쪽: 인솔자 위치에 내 플레이어를 맞춘다 ─────────────────────────

/**
 * 늦게 도착한 만큼을 더해 **지금** 위치를 구한다 (명세 §4.1).
 *
 * 멈춰 있으면 흐르지 않으므로 그대로 쓴다. 틀고 있으면 `serverTs` 이후 흐른 만큼을 더한다 —
 * 봉투의 `ts`(보낸 시각)가 아니라 **그 위치의 기준 시각**이어야 한다.
 *
 * **보정값을 통째로 믿지 않는다.** `Date.now()` 는 내 기기 시계고 `serverTs` 는 서버 시계라,
 * 기기 시계가 몇 분 틀어져 있으면 보정이 재앙이 된다 — 곡 끝으로 날아가거나 0 으로 되감긴다.
 * 그래서 0 아래로는 안 내려가고 위로는 이 창을 넘지 않게 자른다. 정상 지연은 수백 ms 다.
 */
const MAX_LATENCY_MS = 10_000;

export function positionNow(positionMs: number, state: RidePlaybackState, serverTs: number): number {
  if (state !== "PLAYING") return Math.max(0, positionMs);
  const elapsed = Math.min(Math.max(0, Date.now() - serverTs), MAX_LATENCY_MS);
  return Math.max(0, positionMs) + elapsed;
}

/**
 * 그 곡을 `positionMs` 지점부터 튼다.
 *
 * **플레이어는 곧바로 옮겨지지 않는다.** `loadVideoById` 직후에는 아직 영상을 세우는 중이라
 * `seekTo` 가 삼켜진다. 그래서 위치를 적어 두고, 트랜스포트가 **그 곡을 실제로 틀기 시작했다고
 * 보고할 때** 옮긴다 (`subscribePlayback`). 타이머로 찍어 맞추는 것보다 정확하고, 영원히
 * 매달리지도 않는다 — 보고가 안 오면 아무 일도 일어나지 않는다.
 *
 * `shouldPlay` 가 false 면 옮긴 **뒤에** 멈춘다. 인솔자가 멈춰 있는 지점에 맞춰 서는 길이다.
 * 소리가 아주 잠깐 난다 — 브라우저가 위치를 옮기려면 한 번 틀어야 하기 때문이다.
 * ponytail: 무음 선재생까지는 안 한다. 거슬리면 muted 로 태우고 도착 후 음소거 해제로 바꾼다.
 *
 * `receivedAt` 은 `positionMs` 가 맞았던 내 시계 시각이다. 받고 나서 기다렸다 트는 쪽(`RIDE_TRACK` 의 제목 대기)은
 * 받은 시각을 넘겨야 기다린 만큼이 메워진다 (S15P21A405-682).
 */
export function playFrom(musicId: number, positionMs: number, shouldPlay: boolean, receivedAt: number = Date.now()): void {
  anchor = { musicId, positionMs: Math.max(0, positionMs), playing: shouldPlay, localAt: receivedAt };
  usePlayerStore.getState().playSingle(musicId);
  seekWhenReady(musicId, shouldPlay);
}

/** 이미 틀고 있는 곡 안에서 위치·상태만 맞춘다 (`RIDE_PLAYBACK`) */
export function syncPlayback(positionMs: number, state: RidePlaybackState): void {
  const player = usePlayerStore.getState();
  const shouldPlay = state === "PLAYING";
  if (anchor) anchor = { ...anchor, positionMs: Math.max(0, positionMs), playing: shouldPlay, localAt: Date.now() };
  const p = getPlayer();
  if (p) p.seekTo(positionMs / 1000, true);
  if (shouldPlay && !player.isPlaying) player.toggle();
  else if (!shouldPlay && player.isPlaying) player.pause();
}

/**
 * 따라가는 사람이 맞춰야 할 기준 — 인솔자 곡의 한 지점과, 그걸 **내 시계로** 받은 시각 (S15P21A405-682).
 *
 * 서버 시각(`serverTs`)은 받는 순간 `positionNow` 로 한 번만 쓰고 버린다. 그 뒤로 기기 시계와 서버 시계를
 * 섞으면 시계가 틀어진 기기에서 보정이 곡 끝이나 0 으로 튄다 — 여기서는 내 시계끼리만 뺀다.
 */
export interface RideAnchor {
  musicId: number;
  positionMs: number;
  playing: boolean;
  localAt: number;
}

let anchor: RideAnchor | null = null;

/** 기준에서 `now` 까지 흐른 만큼 더한 기대 위치. 멈춰 있으면 흐르지 않는다 */
export function anchorPositionAt(a: RideAnchor, now: number): number {
  return a.playing ? a.positionMs + Math.max(0, now - a.localAt) : a.positionMs;
}

/**
 * 되돌릴 위치. 허용 범위 안이면 null 이다.
 *
 * **곡 끝 근처로는 옮기지 않는다.** 인솔자 쪽 곡 길이(서버 `duration`)와 내 영상 길이가 다르면 기대 위치가
 * 영상 끝을 넘는다 — 거기로 옮기면 곡이 끝나 버리고 다음 곡(`RIDE_TRACK`)까지 조용해진다.
 * 길이를 모르면(`durationMs` 0) 이 확인은 건너뛴다.
 */
export function driftTarget(actualMs: number, expectedMs: number, durationMs: number): number | null {
  const tolerance = REALTIME.rideDriftToleranceMs;
  if (durationMs > 0 && expectedMs >= durationMs - tolerance) return null;
  return Math.abs(actualMs - expectedMs) > tolerance ? expectedMs : null;
}

/**
 * 따라가는 중이면 어긋남을 확인해 되돌린다 (S15P21A405-682). `use-ride-session` 이 주기적으로 부른다.
 *
 * 인솔자가 재생 조작(`RIDE_PLAYBACK`)을 보낼 때만 맞추면, 곡만 넘기는 인솔자를 따라갈 때는 로딩·버퍼링으로
 * 생긴 어긋남이 곡 끝까지 남는다. **내가 멈춰 둔 동안은 건드리지 않는다** — 다시 틀면 그때 맞춘다.
 */
export function correctDrift(): void {
  const a = anchor;
  if (!a || !a.playing || pendingSeek) return;
  if (!useFollowStore.getState().leaderEmail) return;
  const player = usePlayerStore.getState();
  if (!player.isPlaying || player.currentMusicId !== a.musicId) return;
  const p = getPlayer();
  if (!p) return;
  const duration = p.getDuration();
  const target = driftTarget(currentPositionMs(), anchorPositionAt(a, Date.now()), Number.isFinite(duration) ? toMs(duration) : 0);
  if (target != null) p.seekTo(target / 1000, true);
}

/** 기다리고 있는 위치 맞추기. 곡이 또 바뀌면 이전 것은 버린다 */
let pendingSeek: { musicId: number; shouldPlay: boolean } | null = null;
let unsubscribePlayback: (() => void) | null = null;

/**
 * 옮길 위치는 **곡이 실제로 틀리기 시작한 순간** 기준에서 계산한다 (S15P21A405-682). 받은 위치를 그대로 쓰면
 * 영상을 세우는 동안(대개 수백 ms~수 초) 흐른 만큼 인솔자보다 늦는다.
 */
function seekWhenReady(musicId: number, shouldPlay: boolean): void {
  pendingSeek = { musicId, shouldPlay };
  if (unsubscribePlayback) return;
  unsubscribePlayback = subscribePlayback((event) => {
    const want = pendingSeek;
    if (!want || event.musicId !== want.musicId || event.state !== "playing") return;
    pendingSeek = null;
    const p = getPlayer();
    const a = anchor;
    const target = a && a.musicId === want.musicId ? anchorPositionAt(a, Date.now()) : 0;
    if (p && Math.abs(target - currentPositionMs()) > REALTIME.rideSeekMinGapMs) p.seekTo(target / 1000, true);
    if (!want.shouldPlay) usePlayerStore.getState().pause();
  });
}

/** 탑승이 끝나면 기다리던 위치 맞추기와 기준도 버린다 — 하차 뒤에 엉뚱한 곳으로 튀지 않게 */
export function cancelPendingSeek(): void {
  pendingSeek = null;
  anchor = null;
  unsubscribePlayback?.();
  unsubscribePlayback = null;
}

// ── 탑승이 끝났다 ──────────────────────────────────────────────────────────

/**
 * 하차와 강제 종료(`RIDE_ENDED`)가 **같은 함수를 쓴다** (명세 §4.3).
 * 둘은 같은 상태로 끝나므로 두 벌로 두면 한쪽만 고쳐지는 사고가 난다.
 *
 * **재생은 건드리지 않는다.** 듣던 곡은 그대로 이어서 튼다 — 서버도 아무 재생 명령을 보내지
 * 않는다. 소리를 끊으면 브라우저 자동재생 제약 때문에 다시 켜는 데 탭이 필요해진다.
 *
 * **자리는 응답이 말한 곳이다.** 탑승 전 자리로 되돌리지 않는다. 인솔자가 층을 옮겼으면
 * `layer` 가 탈 때와 다르게 온다 (§8.4) — 그대로 두면 하차 직후 한 겹 어긋난 화면이 된다.
 */
/**
 * **화면에서 먼저 내린다** (S15P21A405-674) — 우주선·배너를 지우고, 기다리던 위치 맞추기를 버린다.
 * 서버에는 아직 아무 말도 하지 않는다. 하차 버튼이 누르는 순간 이걸 부르고, 응답이 오면 `endRide` 가
 * 자리를 바로잡고 presence 를 보낸다. presence 를 먼저 보내면 서버는 아직 나를 태우고 있는 채라 순서가 어긋난다.
 */
export function leaveRideLocally(): void {
  cancelPendingSeek();
  const leader = useFollowStore.getState().leaderEmail;
  useFollowStore.getState().stop();
  getMapEngine()?.stopFollow();
  // 인솔자 표식의 동승 인원도 먼저 하나 뺀다 — 혼자 타고 있었으면 우주선이 바로 헬멧이 된다 (S15P21A405-677)
  if (leader) adjustRiderCount(leader, -1);
}

export function endRide(at: { musicId: number | null; layer: number }): void {
  leaveRideLocally();
  // 자리를 모르는 길이 하나 있다 — 이미 끝나 있어 `RIDE_NOT_RIDING` 이 온 경우다. 그때는 안 옮긴다
  if (at.musicId != null) {
    useMapStore.getState().setMyMusicId(at.musicId);
    // 듣던 곡이 곧 내 자리다 — 표식·돌아갈 자리·가운데 고정을 그 곡에 못 박는다 (S15P21A405-677)
    getMapEngine()?.settleAfterRide(at.musicId);
  }
  /**
   * 겹 맞추기. **내려가는 쪽도 된다** (S15P21A405-560) — 엔진에 겹을 직접 지정하는 입구가
   * 생겼다. 예전에는 떠오르는 쪽만 할 수 있어서, 인솔자가 더 깊이 내려간 상태로 내리면
   * 겹이 어긋난 채 남았다.
   *
   * **`stopFollow` 보다 먼저다.** `rideToLayer` 는 따라가는 상태를 보고 자리를 잡는다.
   */
  const map = useMapStore.getState();
  if (at.layer < map.layer) map.surfaceTo(at.layer);
  /**
   * 인솔자 화면(여정·플리 별자리·주변 탐색)을 따라 보고 있었으면 **기본으로 돌아간다** (S15P21A405-653, §8-2).
   * 그 뷰는 내 것이 아니라 인솔자 것이었다 — 내리고도 남아 있으면 끌 길이 없는 화면이 된다.
   */
  if (map.viewMode === "nearby") map.exitNearby();
  else if (map.viewMode === "constellation") map.clearConstellation();
  // 평소 상태로 돌아왔다 — 서버에 다시 알려야 지도가 멈춘 채로 남지 않는다 (§4.3)
  sendJoinNow(at.layer);
  pushViewport();
}

// ── 인솔자 쪽: 내 조작을 선단에 알린다 ──────────────────────────────────────

/**
 * 재생 조작을 알린다 (명세 §5.1).
 *
 * **따라오는 사람이 하나도 없어도 보낸다.** 서버가 스냅샷으로 저장해 뒀다가 나중에 타는
 * 사람에게 같은 지점부터 들려준다. 안 보내면 중간에 탄 사람이 곡 처음부터 듣는다.
 *
 * **따라가는 중이면 보내지 않는다.** 그 경로는 서버가 `RIDE_NOT_CAPTAIN` 으로 거부한다 —
 * 오류 큐만 시끄러워지고 아무 일도 일어나지 않는다.
 */
export function publishPlayback(event: RidePlaybackEvent, positionMs: number): void {
  if (useFollowStore.getState().leaderEmail) return;
  send(REALTIME.send.ridePlayback, { event, positionMs: Math.max(0, Math.round(positionMs)) });
}

/**
 * 재생바를 끄는 동안의 발행을 **간격 제한**한다 (명세 §5.1 · D10).
 *
 * 서버는 받는 대로 넘기므로 잦은 발송을 막는 것은 프론트 몫이다. 다만 **마지막 위치는 반드시
 * 나간다** — 거기서 끊기면 따라가는 사람이 끌다 만 자리에 멈춘다.
 */
let seekTimer: ReturnType<typeof setTimeout> | null = null;
let seekLastAt = 0;
let seekPending: number | null = null;

export function publishSeek(positionMs: number): void {
  const now = Date.now();
  const since = now - seekLastAt;
  if (since >= REALTIME.rideSeekThrottleMs) {
    seekLastAt = now;
    publishPlayback("SEEK", positionMs);
    return;
  }
  seekPending = positionMs;
  if (seekTimer) return;
  seekTimer = setTimeout(() => {
    seekTimer = null;
    if (seekPending == null) return;
    seekLastAt = Date.now();
    publishPlayback("SEEK", seekPending);
    seekPending = null;
  }, REALTIME.rideSeekThrottleMs - since);
}

/**
 * 지도를 보는 모양을 알린다 (BACKEND-NOTES §8, S15P21A405-653). 따라오는 사람이 없어도 보낸다 — 서버가 저장해 뒀다가
 * 나중에 타는 사람에게 준다. 따라가는 중이면 보내지 않는다(`RIDE_NOT_CAPTAIN`).
 */
export function publishView(view: RideViewRequest): void {
  if (useFollowStore.getState().leaderEmail) return;
  send(REALTIME.send.rideView, view);
}

/** 곡 상세를 열고 닫은 것을 알린다 (명세 §5.2). 닫을 때는 `open:false` 만 보낸다 */
export function publishPanel(open: boolean, musicId?: number, tab: RidePanelTab = "info"): void {
  if (useFollowStore.getState().leaderEmail) return;
  // 열면서 곡이 없으면 서버가 `RIDE_PANEL_INVALID` 로 거부한다. 보내지 않는 편이 낫다
  if (open && musicId == null) return;
  send(REALTIME.send.ridePanel, open ? { open, musicId, tab } : { open: false });
}
