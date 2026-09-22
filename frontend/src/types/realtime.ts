/**
 * 실시간(위치·지도 위 사람·주변 사람) 타입 — 실시간 작업명세 §8 (S15P21A405-482).
 *
 * **REST 의 `{success, data, error}` 봉투와 다르다.** 소켓 프레임은 `lib/api.ts` 통로를 거치지
 * 않으므로 여기 `RealtimeMessage` 가 그 자리를 대신한다.
 *
 * **레이어는 0-based 다. `+1` 하지 않는다** (명세 §1.1). `useMapStore.layer` 와 같은 번호다.
 * 예외는 곡 조회 `GET /bff/map/songs` 하나뿐이고(거기만 `level = boxes.length + 1`), 그 습관을
 * 여기로 옮기면 한 겹 어긋난 사람 목록을 받는다.
 *
 * **좌표는 전부 원시 PC 다** (명세 §1.2). `MapEngine` 이 쓰는 그 좌표이고 0~1 정규화 값이
 * 아니다. 받은 `x`·`y` 는 `worldToScreen` 에 그대로 넣는다.
 */

import type { PlaySource } from "./play-history";

/** 모든 소켓 수신 프레임의 봉투 */
export interface RealtimeMessage<T> {
  type: RealtimeMessageType;
  /**
   * **내 연결에 보낸 메시지 순번**(단조 증가). 마지막 처리 seq 이하면 버린다.
   *
   * **연결 단위로 리셋된다** (명세 §2.2·§12.2). 재연결하면 서버가 1부터 다시 매기므로,
   * 연결이 열릴 때마다 0 으로 초기화해야 한다. 이전 값을 들고 있으면 새 연결의 정상 프레임이
   * 전부 "옛날 것"으로 걸러져 **화면이 통째로 안 그려진다** — 오류도 안 뜨는 함정이다.
   */
  seq: number;
  /** 서버 시각(epoch ms). 표시·디버깅용 */
  ts: number;
  payload: T;
}

export type RealtimeMessageType =
  | "PRESENCE_JOINED"
  | "VIEWPORT_SNAPSHOT"
  | "VIEWPORT_ENTER"
  | "VIEWPORT_MOVE"
  | "VIEWPORT_LEAVE"
  | "VIEWPORT_CELL_COUNTS"
  | "VIEWPORT_BULK_ENTER"
  | "VIEWPORT_RIDER_COUNT"
  | "NEARBY_SNAPSHOT"
  | "NEARBY_ENTER"
  | "NEARBY_MOVE"
  | "NEARBY_LEAVE"
  | "NEARBY_BULK_ENTER"
  | "NEARBY_RIDER_COUNT"
  // 따라가기 (2차 명세 §2.3, S15P21A405-530)
  | "RIDE_TRACK"
  | "RIDE_PLAYBACK"
  | "RIDE_PANEL"
  | "RIDE_VIEWPORT"
  | "RIDE_VIEWPORT_ENTER"
  | "RIDE_VIEWPORT_MOVE"
  | "RIDE_VIEWPORT_LEAVE"
  | "RIDE_VIEWPORT_CELL_COUNTS"
  | "RIDE_VIEWPORT_BULK_ENTER"
  | "RIDE_VIEWPORT_RIDER_COUNT"
  | "RIDE_RIDER_LEFT"
  | "RIDE_ENDED"
  | "PRESENCE_ERROR";

// ── 내 위치 ────────────────────────────────────────────────────────────────

export interface JoinRequest {
  /** 1 이상 단조 증가. 오류 payload 에 그대로 돌아와 어느 요청이 실패했는지 알려준다 */
  requestSeq: number;
  layer: number;
  /** 참고값이다 — 서버가 정한 곡이 `PresenceJoined.musicId` 로 온다 */
  musicId: number;
}

/** 응답의 `musicId` 가 내 진짜 위치다. 요청에 넣은 값과 다를 수 있다 */
export interface PresenceJoined {
  requestSeq: number;
  layer: number;
  musicId: number;
}

// ── 재생 ──────────────────────────────────────────────────────────────────

export interface PlayRequest {
  musicId: number;
  source: PlaySource;
  /**
   * `useMapStore.layer`. **항상 넣는다** — 이미 지도에 서 있으면 무시되고, 아직 없으면
   * 이 값으로 첫 자리를 잡는다. 빠지면 첫 배치에서 422 다.
   */
  layer?: number;
}

export interface PlayResponse {
  /** 보관한다 — 재생이 끝날 때 이 ID 로 종료를 보낸다 */
  playHistoryId: number;
  musicId: number;
  layer: number;
  /** 내 표식의 원시 PC 좌표 */
  x: number;
  y: number;
  /** 디버깅용. 화면 계산에 쓰지 않는다 */
  cellX: number;
  cellY: number;
}

export interface PlayEndRequest {
  playHistoryId: number;
  /** 실제로 들은 시간(ms), 0 이상. 여러 번 보내도 되고 마지막 값이 남는다 */
  playedMs: number;
}

// ── 뷰포트 (지도 위 사람) ──────────────────────────────────────────────────

export interface LayerBound {
  layer: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewportRequest {
  /** 뷰포트 전용 카운터 — **join 카운터와 별개다** */
  requestSeq: number;
  layer: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** 길이 = `layer`, `bounds[i].layer === i` 순서. 레이어 0 이면 `[]` */
  ancestorBounds: LayerBound[];
}

export interface ViewportUser {
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  /** 이 사람을 따라가는 인원. 선단은 지도에서 한 점이라 동승자 명단 대신 이 정수만 온다 */
  riderCount: number;
}

/** 같은 곡 위에 서 있는 사람들의 묶음. 같은 그룹은 같은 자리다 */
export interface ViewportMusicGroup {
  musicId: number;
  x: number;
  y: number;
  users: ViewportUser[];
}

export interface ViewportCellCount {
  /** 키·디버깅용. 위치 계산에 쓰지 않는다 */
  cellX: number;
  cellY: number;
  /** 뭉치를 찍을 원시 PC 좌표 (화면 범위 안으로 잘려서 온다) */
  x: number;
  y: number;
  count: number;
}

export interface ViewportSnapshot {
  requestSeq: number;
  /**
   * 화면 구성이 완전히 다르다. `INDIVIDUAL` 은 사람을 한 명씩, `CLUSTERED` 는 "N명" 뭉치.
   * `CLUSTERED` 에서는 **개별 델타가 오지 않고** `VIEWPORT_CELL_COUNTS` 로 5초마다 갱신된다.
   */
  mode: "INDIVIDUAL" | "CLUSTERED";
  layer: number;
  groups: ViewportMusicGroup[];
  resolution: number | null;
  cells: ViewportCellCount[];
}

/** `INDIVIDUAL` 일 때만 온다. `VIEWPORT_LEAVE` 는 `email` 만 유효하다 */
export interface ViewportDelta {
  requestSeq: number;
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  musicId: number | null;
  x: number | null;
  y: number | null;
  riderCount: number | null;
}

export interface ViewportCellCounts {
  requestSeq: number;
  layer: number;
  resolution: number;
  cells: ViewportCellCount[];
}

export interface ViewportCloseRequest {
  requestSeq: number;
}

/**
 * `VIEWPORT_BULK_ENTER` / `RIDE_VIEWPORT_BULK_ENTER` — 여러 사람이 **한 자리에** 한꺼번에 나타났다.
 *
 * 선단이 흩어질 때만 온다. 스무 명을 한 명씩 알리면 스무 번 다시 그리게 되고 중간 상태가 그대로
 * 보인다. 전원이 인솔자의 마지막 곡에 남으므로 자리는 `musicId`·`x`·`y` 하나뿐이다.
 */
export interface ViewportBulkEnter {
  requestSeq: number;
  musicId: number;
  x: number;
  y: number;
  users: ViewportUser[];
}

/**
 * `VIEWPORT_RIDER_COUNT` — 화면 속 누군가의 **인원수만** 바뀌었다 (2차 명세 §7.1).
 *
 * **자리는 그대로다.** 좌표가 오지 않으니 그 사람의 `riderCount` 만 갈아 끼우고 위치는
 * 건드리지 않는다. 이게 없으면 스무 명이 타고 내려도 구경하는 쪽에는 같은 수로 보인다.
 */
export interface ViewportRiderCount {
  requestSeq: number;
  email: string;
  riderCount: number;
}

/**
 * `GET /api/realtime/layers/{layer}/users` 응답 — 그 겹에서 **재생 중인 사람 전부**
 * (S15P21A405-537, BACKEND-NOTES §5).
 *
 * **화면 범위와 무관하다.** 소켓 `VIEWPORT_SNAPSHOT` 은 보이는 범위만 주고 칸이 36개를 넘으면
 * "N명" 뭉치(`CLUSTERED`)로 바꾸는데, 지도는 줌과 상관없이 사람을 전부 한 명씩 그리기로 했다.
 *
 * **`groups` 모양이 `ViewportSnapshot.groups` 와 같다.** 백엔드가 같은 레코드를 재사용해서
 * 일부러 맞춰 줬다 — 그래서 `NearbyUser` 로 옮기는 변환기를 하나만 둔다.
 *
 * 좌표를 모르는 곡(위치가 없는 곡)의 사람은 **응답에서 빠진다.** 빈 목록이 정상일 수 있다.
 */
export interface LayerUsersSnapshot {
  layer: number;
  groups: ViewportMusicGroup[];
}

// ── 주변 사람 패널 ─────────────────────────────────────────────────────────

/**
 * 뷰포트의 `NearbyUser` 와 **다른 타입이다.** 좌표가 없고(지도에 찍지 않는다) 대신 듣는 곡과
 * 거리·만남수가 있다. 기준도 화면 범위가 아니라 내가 듣는 곡과 비슷한 곡이다.
 */
export interface NearbyPerson {
  email: string;
  /** **`null` 일 수 있다** — 빈 자리 처리가 필요하다 */
  nickname: string | null;
  imageUrl: string | null;
  meetingCount: number;
  /** 이 사람을 따라가는 인원 (S15P21A405-530) */
  riderCount: number;
  /** 그 사람이 지금 듣는 곡 */
  musicId: number;
  title: string;
  artist: string | null;
  /** 내 곡과의 거리(정렬 근거). `0` 이면 나와 같은 곡 */
  distance: number;
}

export interface NearbySnapshot {
  /** 기준이 된 내 곡 */
  anchorMusicId: number;
  /**
   * 이 목록이 이미 반영한 마지막 메시지 순번. 봉투 `seq` 가 이 값 이하인 `NEARBY_*` 는 버린다.
   * 연결이 새로 열리면 서버 카운터도 0 부터 다시 매겨지므로 재연결 뒤에는 새로 받아야 한다.
   */
  snapshotSeq: number;
  /** 가까운 순 평면 목록. **나는 없다** */
  people: NearbyPerson[];
}

/** `NEARBY_ENTER`/`MOVE`/`LEAVE`. `distance` 가 오지 않는다 */
export interface NearbyChange {
  email: string;
  nickname: string | null;
  imageUrl: string | null;
  meetingCount: number | null;
  riderCount: number | null;
  musicId: number | null;
}

/**
 * `NEARBY_BULK_ENTER` — 선단이 흩어져 여럿이 한꺼번에 목록에 들어왔다 (2차 명세 §7.2).
 * `people` 은 `NEARBY_ENTER` 와 같은 모양이고 `requestSeq` 가 없다.
 *
 * **한 덩어리로 받았으니 한 번만 다시 그린다.** 반복문으로 하나씩 갱신하면 이 메시지를 만든
 * 의미가 없어진다.
 */
export interface NearbyBulkEnter {
  musicId: number;
  people: NearbyChange[];
}

/** `NEARBY_RIDER_COUNT` — 목록 속 누군가의 인원수만 바뀌었다. `requestSeq` 가 없다 */
export interface NearbyRiderCount {
  email: string;
  riderCount: number;
  musicId: number;
}

// ── 따라가기 (탑승) ────────────────────────────────────────────────────────

/**
 * 따라가기 = **탑승(ride)** 이다 (S15P21A405-530). 구독(follow)과 다르다 — 구독은 오래 남는
 * 관계이고, 탑승은 지금 이 순간 남의 탐색을 그대로 따라다니는 것이다.
 *
 * **탑승·하차만 REST 다.** 실패가 사용자에게 보여야 하는 경로라서다 — 소켓으로 보내면 거부당해도
 * 아무 응답이 안 와서 버튼만 안 먹는 것처럼 보인다. 인솔자의 조작 전파는 전부 소켓이다.
 */

/** 인솔자가 지금 틀고 있는지 멈춰 있는지. 재생 위치를 읽는 방식이 갈린다 */
export type RidePlaybackState = "PLAYING" | "PAUSED";

/** 인솔자가 한 재생 조작의 종류. `DRIFT` 는 어긋남 보정이고 프론트는 아직 보내지 않는다 */
export type RidePlaybackEvent = "PLAY" | "PAUSE" | "SEEK" | "DRIFT";

/**
 * 곡 상세에서 보고 있는 탭. **우리 화면에는 탭이 없다** — 곡 상세는 한 장짜리 스크롤이다.
 * 계약이 값을 요구하므로 열 때 `info` 를 싣고, 받는 쪽은 탭을 보지 않고 그 곡 상세를 연다.
 */
export type RidePanelTab = "nearby" | "info" | "playlists";

/** 인솔자가 열어 둔 곡 상세. `open` 이 false 면 나머지는 null 이다 */
export interface RidePanelPayload {
  open: boolean;
  musicId: number | null;
  tab: RidePanelTab | null;
}

/**
 * `POST /api/realtime/ride` 응답 — 어디에 서게 됐고 무슨 곡을 어디서부터 틀면 되는지.
 *
 * **`positionMs` 는 서버가 계산해서 준다.** 저장값에서 직접 빼면 기기 시계가 틀린 만큼 어긋난다.
 * `playHistoryId` 는 따라가는 사람 **자신의** 기록이라 재생 시간 저장에 그대로 쓴다.
 */
export interface RideRequest {
  captainEmail: string;
}

export interface RideResponse {
  captainEmail: string;
  playHistoryId: number;
  musicId: number;
  layer: number;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
  playback: RidePlaybackState;
  positionMs: number;
  /**
   * 재생 스냅샷의 번호.
   *
   * **2차 명세 §4.1 은 "봉투 `seq ≤ snapshotSeq` 면 버린다" 고 적었지만 그대로 하면 안 된다.**
   * 배포 백엔드에서 둘은 **서로 다른 카운터**다 —
   * `snapshotSeq` 는 인솔자별 Redis 해시의 `HINCRBY ride:playback:{captain} snapshotSeq`,
   * 봉투 `seq` 는 **내 소켓 세션**의 메시지 번호(`nextMessageSeq(userId)`)다.
   *
   * 견주면 조용히 망가진다. 한참 틀고 있던 인솔자(`snapshotSeq` 가 이미 큼)에 방금 접속한
   * 사람(`seq` 가 1부터)이 타면 **초반 `RIDE_PLAYBACK` 이 전부 버려진다** — 오류도 안 뜬다.
   * 그래서 보관만 하고 거르는 데 쓰지 않는다. 순서 보장은 `stomp-client` 의 봉투 `seq` 비교가
   * 이미 하고 있다. 백엔드에 확인 요청해 둔 항목이다 (BACKEND-NOTES A-41).
   */
  snapshotSeq: number;
  /** 중간에 타도 같은 화면을 보게 하려고 인솔자가 열어 둔 곡 상세를 함께 준다 */
  panel: RidePanelPayload;
}

/**
 * `DELETE /api/realtime/ride` 응답 — 내려서 남게 된 자리.
 * 인솔자가 마지막으로 있던 곡이다. **탑승 전 자리로 되돌리지 않는다** (D15).
 */
export interface DismountResponse {
  musicId: number;
  layer: number;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
}

/**
 * `RIDE_TRACK` — 인솔자가 곡을 바꿨다. **새 곡은 처음부터 튼다** (그래서 재생 위치가 없다).
 * `playable` 이 false 면 위치만 옮기고 틀지 않는다.
 */
export interface RideTrackPayload {
  musicId: number;
  layer: number;
  x: number;
  y: number;
  playable: boolean;
  serverTs: number;
}

/**
 * `RIDE_PLAYBACK` — 인솔자의 재생 조작.
 *
 * `event` 와 `state` 를 **둘 다** 본다. 재생바만 옮긴 경우(`SEEK`)는 멈춤·재생 상태가 그대로라,
 * 받는 쪽이 "옮기기만 할지 틀기까지 할지" 를 `state` 로 가른다.
 *
 * `serverTs` 는 **보낸 시각이 아니라 이 위치의 기준 시각**이다. 봉투의 `ts` 로 대신할 수 없다.
 */
export interface RidePlaybackPayload {
  event: RidePlaybackEvent;
  state: RidePlaybackState;
  positionMs: number;
  serverTs: number;
}

/** `RIDE_RIDER_LEFT` — 따라오던 사람이 내렸다. **인솔자에게만** 온다 */
export interface RideRiderLeftPayload {
  email: string;
  /** 내린 뒤 남은 인원. 다시 물어보지 않아도 되게 같이 온다 */
  riderCount: number;
}

/**
 * `RIDE_ENDED` — 인솔자가 사라져 따라가기가 끝났다. **따라가던 사람에게만** 온다.
 * 스스로 내렸을 때와 같은 상태이므로 자리 정보도 하차 응답과 같다.
 */
export interface RideEndedPayload {
  captainEmail: string;
  reason: "CAPTAIN_LEFT";
  musicId: number;
  layer: number;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
}

/** C→S `/app/ride/playback`. `positionMs` 는 0 이상이어야 한다 — 아니면 서버가 거부한다 */
export interface RidePlaybackRequest {
  event: RidePlaybackEvent;
  positionMs: number;
}

/** C→S `/app/ride/panel`. 닫을 때는 `musicId`·`tab` 이 없어도 된다 */
export interface RidePanelRequest {
  open: boolean;
  musicId?: number;
  tab?: RidePanelTab;
}

// ── 오류 ──────────────────────────────────────────────────────────────────

export type WebSocketErrorCode =
  | "PRESENCE_NO_ANCHOR"
  | "PRESENCE_LOCATION_NULL"
  | "PRESENCE_LAYER_INVALID"
  | "PRESENCE_JOIN_INVALID"
  | "PRESENCE_VIEWPORT_INVALID"
  | "PRESENCE_STALE"
  | "PRESENCE_NOT_CONNECTED"
  // 따라가기 (S15P21A405-530)
  /** 인솔자만 보낼 수 있는 곳으로 동승자가 보냈다. 내리면 된다 */
  | "RIDE_NOT_CAPTAIN"
  | "RIDE_PLAYBACK_INVALID"
  | "RIDE_PANEL_INVALID";

export interface PresenceErrorPayload {
  code: WebSocketErrorCode;
  message: string;
  /** join·viewport 오류에만 붙는다 */
  requestSeq?: number;
}

/**
 * 엔진이 그리는 "N명" 뭉치 (S15P21A405-482).
 *
 * `ViewportCellCount` 에서 **그릴 때 쓰는 값만** 추린 것이다. `cellX`·`cellY`·`resolution` 은
 * 키·디버깅용이라 엔진까지 들고 가지 않는다 (명세 §5.2 B: "위치 계산에 쓰지 않는다").
 */
export interface CrowdCell {
  x: number;
  y: number;
  count: number;
}
