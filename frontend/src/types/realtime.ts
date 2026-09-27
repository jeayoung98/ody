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
  | "RIDE_VIEW"
  | "RIDE_VIEWPORT"
  | "RIDE_VIEWPORT_ENTER"
  | "RIDE_VIEWPORT_MOVE"
  | "RIDE_VIEWPORT_LEAVE"
  | "RIDE_VIEWPORT_CELL_COUNTS"
  | "RIDE_VIEWPORT_BULK_ENTER"
  | "RIDE_VIEWPORT_RIDER_COUNT"
  | "RIDE_RIDER_JOINED"
  | "RIDE_RIDER_LEFT"
  | "RIDE_ENDED"
  // 반응하기 (S15P21A405-607). 받는 사람 개인 큐로만 온다
  | "REACTION"
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
 * 뷰포트의 `NearbyUser` 와 **다른 타입이다.** 만남수가 있고 화면 범위가 아니라 층이 기준이다.
 *
 * **기준이 내 층 전체가 됐다** (S15P21A405-582, 5차 명세). 예전에는 내 곡과 비슷한 곡 열 개를
 * 듣는 사람만 담았는데 사람이 적을 때 목록이 거의 비어서, 그 층에 있는 사람을 전부 담고 가까운
 * 순으로 자르는 것으로 바뀌었다. 패널을 그 층의 **미니맵**으로 본다.
 *
 * 그래서 **곡 제목과 가수가 빠지고 좌표가 들어왔다.** 화면이 사람만 보여 주기로 했고, 좌표가
 * 있어야 레이더가 같은 곡을 듣는 사람을 같은 자리에 모을 수 있다.
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
  /**
   * 그 층 표시축의 **원시 좌표** — 지도에 찍는 값과 같은 눈금이다 (S15P21A405-582).
   *
   * **`null` 일 수 있다.** 델타로 들어온 사람은 서버가 자리를 못 구했을 때 비워 보내고, 그때는
   * 듣는 곡으로 지도에서 찾아본다 (`use-nearby-list` 의 `pointOfPerson`).
   */
  x: number | null;
  y: number | null;
  /**
   * 내 자리에서 그 사람까지의 거리 (정렬 근거). `0` 이면 나와 같은 곡.
   *
   * **서버 값을 그대로 믿지 않는다.** 서버는 스냅샷에만 담아 주는데 그 스냅샷은 **층을 옮길
   * 때만** 온다 (5차 명세 §3). 내가 같은 층에서 곡을 바꾸면 거리가 달라지는데 새 목록이 안
   * 오므로, 화면이 좌표로 매번 다시 잰다.
   */
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
  /**
   * 옮겨 간 자리 (S15P21A405-582). `NEARBY_LEAVE` 는 전부 `null` 이다.
   *
   * **거리는 안 온다.** 받는 사람마다 다른 값이라 서버가 구하려면 사람 수만큼 조회가 도는데,
   * 곡이 바뀔 때마다 도는 자리라 감당이 안 된다 — 좌표만 받아 화면이 직접 잰다 (5차 명세 §2).
   */
  x: number | null;
  y: number | null;
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
   * 인솔자의 재생 정보 버전. **거르는 데 쓰지 않는다** — 디버깅용이다.
   *
   * 봉투 `seq` 와 **다른 카운터다.** 이쪽은 인솔자 한 명의 재생 정보가 몇 번 바뀌었나이고
   * (`HINCRBY ride:playback:{인솔자}`), 봉투 `seq` 는 내 소켓에 몇 번째 메시지인가다
   * (`nextMessageSeq(나)`, 연결마다 0). 2차 명세는 둘을 견주라고 적었지만 그대로 하면 한참
   * 틀고 있던 인솔자에 방금 접속한 사람이 타는 순간 초반 `RIDE_PLAYBACK` 이 전부 버려진다.
   *
   * **백엔드가 문구를 고쳤다** (3차 계약 §1, S15P21A405-545). `RIDE_PLAYBACK` 에 이 값을
   * 싣지 않기로 확정됐고, 순서 보장은 봉투 `seq` 단조성이 이미 한다. 같은 이름이지만
   * `NearbySnapshot.snapshotSeq` 는 **봉투 seq 가 맞다** — 그쪽 규칙은 그대로다.
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
 * `DELETE /api/realtime/ride/fleet` 응답 — 인솔자가 선단을 해체했다 (S15P21A405-606).
 * 값은 전부 **내려간 사람들** 이야기다. 인솔자 자신은 움직이지 않는다 — 화면은 인원수만 0 으로.
 */
export interface DisbandResponse {
  /** 내린 사람 수 */
  riderCount: number;
  /** 내린 사람들이 남은 곡·레이어 (= 인솔자가 서 있는 곡) */
  musicId: number;
  layer: number;
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
  /**
   * 이 곡에 대한 내 재생 기록 번호 (3차 계약 §3).
   *
   * **받긴 받되 쓰지 않는다** (S15P21A405-571). 곡별 청취시간을 남기려고 들고 있던 값인데
   * `PATCH /api/music/play/end` 가 배포에서 없어졌다 — 몇 초 들었는지를 안 남기기로 했다.
   * 서버가 여전히 보내는 필드라 타입에서 지우지는 않는다. 지우면 계약과 어긋난다.
   */
  playHistoryId: number | null;
}

/**
 * `RIDE_RIDER_JOINED` — 누가 나를 따라오기 시작했다 (3차 계약 §2, S15P21A405-545).
 *
 * **인솔자에게만 온다.** `RIDE_RIDER_LEFT` 와 짝이다. 구경꾼에게 가는 인원수 알림은 설계상
 * 인솔자가 빠지므로(요청자 제외), 인솔자가 제 선단의 인원을 아는 길은 이것뿐이다.
 */
export interface RideRiderJoinedPayload {
  email: string;
  /** **탈 때는 처음 보는 사람이라** 이름이 같이 온다. 내릴 때와 다른 점이다. 없을 수 있다 */
  nickname: string | null;
  /** 탄 **뒤의** 인원 */
  riderCount: number;
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

/**
 * 나를 따라오는 한 사람 — 인솔자 화면이 우주선 뒤 헬멧에 그린다 (S15P21A405-676).
 * `RIDE_RIDER_JOINED` 가 주는 것은 이메일·이름뿐이라 사진은 사용자 상세로 따로 받는다 (BACKEND-NOTES A-85).
 */
export interface RideRider {
  email: string;
  nickname: string | null;
  imageUrl: string | null;
}

/** `RIDE_RIDER_LEFT` — 따라오던 사람이 내렸다. **인솔자에게만** 온다 */
export interface RideRiderLeftPayload {
  email: string;
  /** 내린 뒤 남은 인원. 다시 물어보지 않아도 되게 같이 온다 */
  riderCount: number;
}

/**
 * `RIDE_ENDED` — 따라가기가 끝났다. **따라가던 사람에게만** 온다.
 * 스스로 내렸을 때와 같은 상태이므로 자리 정보도 하차 응답과 같다.
 *
 * `reason` 이 둘이다 (백엔드 `RideEndReason`, S15P21A405-606):
 * - `CAPTAIN_LEFT` — 인솔자가 사라졌다 (창을 닫았거나 접속 만료). 이제 없는 사람이다
 * - `CAPTAIN_ENDED` — 인솔자가 **강제 하차(선단 해체)** 를 눌렀다. 인솔자는 같은 곡에 그대로 있다.
 *   "나갔다" 고 알리면 화면과 어긋나므로 문구를 가른다
 */
export interface RideEndedPayload {
  captainEmail: string;
  reason: "CAPTAIN_LEFT" | "CAPTAIN_ENDED";
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

/**
 * 인솔자가 지도를 보는 모양 (BACKEND-NOTES §8, S15P21A405-591 · 653). 프론트 `MapViewMode` 의 `constellation` 은
 * 여기서 `journey`·`playlist` 로 갈린다 — 받는 쪽이 조회할 API 가 다르다.
 */
export type RideViewKind = "default" | "journey" | "playlist" | "nearby";

/**
 * C→S `/app/ride/view` — 내용(경로·곡 목록)은 안 보내고 **무엇을 보는지**만 보낸다. 받는 쪽이 번호로 자기가 조회한다.
 * 종류마다 있어야 하는 번호가 다르다: journey → start/end, playlist → playlistId, nearby → centerMusicId. 빠지면 `RIDE_VIEW_INVALID`
 */
export interface RideViewRequest {
  kind: RideViewKind;
  startMusicId?: number;
  endMusicId?: number;
  playlistId?: number;
  centerMusicId?: number;
}

/**
 * S→C `RIDE_VIEW` — 요청과 같은 모양, 종류에 안 맞는 번호는 `null`. 중간에 탄 사람도 탑승 직후 한 번 받는다
 * (인솔자가 기본 지도면 안 온다). 선단이 흩어지면 서버가 저장값을 지운다 — 라이더는 `RIDE_ENDED` 에서 기본으로 돌아간다
 */
export interface RideViewPayload {
  kind: RideViewKind;
  startMusicId: number | null;
  endMusicId: number | null;
  playlistId: number | null;
  centerMusicId: number | null;
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
  | "RIDE_PANEL_INVALID"
  /** `/app/ride/view` 의 `kind` 를 모르거나 종류에 필요한 번호가 빠졌다 (§8-1) */
  | "RIDE_VIEW_INVALID";

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

// ── 반응하기 ───────────────────────────────────────────────────────────────

/**
 * `REACTION` — 누가 나에게 어떤 반응을 보냈다 (SOCIAL-02, S15P21A405-607).
 * 보낸 사람의 닉네임·사진은 없다 — 받는 쪽이 이미 들고 있는 주변 사람 목록에서 찾는다.
 */
export interface ReactionPayload {
  fromEmail: string;
  /** 프론트 이모지 세트의 키 (`REACTIONS`). 모르는 키는 ✨ 로 그린다 */
  reactionKey: string;
  /** 서버가 보낸 시각(ISO-8601) */
  sentAt: string;
}
