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
  | "NEARBY_SNAPSHOT"
  | "NEARBY_ENTER"
  | "NEARBY_MOVE"
  | "NEARBY_LEAVE"
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
  /** 현재 항상 0 — 따라가기가 아직 없다 */
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
  /** 현재 항상 0 */
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

// ── 오류 ──────────────────────────────────────────────────────────────────

export type WebSocketErrorCode =
  | "PRESENCE_NO_ANCHOR"
  | "PRESENCE_LOCATION_NULL"
  | "PRESENCE_LAYER_INVALID"
  | "PRESENCE_JOIN_INVALID"
  | "PRESENCE_VIEWPORT_INVALID"
  | "PRESENCE_STALE"
  | "PRESENCE_NOT_CONNECTED";

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
