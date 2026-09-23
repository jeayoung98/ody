/**
 * 실시간(STOMP) 주소와 시간값 — 실시간 작업명세 §8 (S15P21A405-482).
 *
 * **소켓 주소는 rewrite 를 타지 않는다.** `next.config.ts` 의 rewrite 는 HTTP 만 다루고,
 * 소켓은 `NEXT_PUBLIC_WS_ORIGIN` 절대 주소로 직접 연다.
 */

/**
 * 소켓 오리진. 비면 지금 페이지에서 유추한다 — `http`→`ws`, `https`→`wss`.
 *
 * 배포는 페이지와 백엔드가 같은 오리진이라 유추가 맞는다. **로컬은 다르다** — Next 가 3000,
 * 백엔드가 8080 이라 유추하면 3000 으로 붙어 연결이 안 된다. 그래서 로컬은 `.env.local` 에
 * `NEXT_PUBLIC_WS_ORIGIN=ws://localhost:8080` 을 넣어야 한다.
 *
 * 서버에서는 `location` 이 없으므로 빈 문자열이다. 소켓은 브라우저에서만 열리니 상관없다.
 */
export function wsOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_WS_ORIGIN;
  if (configured) return configured;
  if (typeof location === "undefined") return "";
  return location.origin.replace(/^http/, "ws");
}

export const REALTIME = {
  ws: { path: "/ws/websocket" },
  /** 구독 대상은 이 둘뿐이다. 토픽 브로드캐스트는 없다 */
  queue: { presence: "/user/queue/presence", errors: "/user/queue/errors" },
  send: {
    join: "/app/presence/join",
    heartbeat: "/app/presence/heartbeat",
    leave: "/app/presence/leave",
    viewport: "/app/presence/viewport",
    viewportClose: "/app/presence/viewport/close",
    nearbyClose: "/app/nearby/close",
    /**
     * 따라가기 — **인솔자만 보낸다** (S15P21A405-530). 동승자가 보내면 서버가
     * `RIDE_NOT_CAPTAIN` 으로 거부한다. 탑승·하차 자체는 소켓이 아니라 REST 다.
     */
    ridePlayback: "/app/ride/playback",
    ridePanel: "/app/ride/panel",
  },

  /**
   * 인솔자가 재생바를 끌 때의 발행 간격 제한(ms) (명세 D10). 3초 드래그에 6건쯤 나간다.
   * **마지막 위치는 반드시 나간다** — 안 그러면 동승자가 끌다 만 자리에 멈춘다.
   */
  rideSeekThrottleMs: 500,
  /** 한 인솔자를 따라갈 수 있는 최대 인원 (2차 명세 §10). 넘으면 `RIDE_FULL` 이다 */
  maxRiders: 20,
  /**
   * heartbeat 주기. 45초를 넘기면 남들 화면에서 내가 사라진다.
   *
   * **이 타이머만 믿지 않는다** (명세 §12.1). 브라우저는 안 보이는 탭의 `setInterval` 을
   * 1분 가까이 늘려서, 실측으로 15초 타이머가 53~61초 간격으로 나갔다. 진짜 복구 지점은
   * `visibilitychange` 다.
   */
  heartbeatMs: 15_000,
  /** 팬·줌이 멎고 이만큼 지난 뒤에 화면 범위를 보낸다. 움직이는 내내 보내지 않는다 */
  viewportDebounceMs: 250,
  /**
   * join·viewport 응답을 이만큼 기다린다 (명세 §12.3).
   *
   * **소켓은 실패해도 아무 응답이 안 올 수 있다.** REST 와 달리 4xx 가 오지 않고, 오류 큐에도
   * 아무것도 안 온 채 그냥 조용한 경우가 실측으로 확인됐다. 무한정 도는 스피너를 만들지 않는다.
   */
  requestTimeoutMs: 3_000,
  /** 끊겼을 때 다시 붙기까지 */
  reconnectDelayMs: 3_000,
} as const;

/**
 * 재생 종료(`playedMs`) 상한 (실시간 작업명세 §12.6).
 *
 * 탭을 열어두고 방치하면 경과시간이 얼마든지 커지는데 그건 실제로 들은 시간이 아니고,
 * 큰 값을 보내면 서버에서 실패한다. 곡 길이를 알면 그걸로 자르고, 모르면 이 값으로 자른다.
 * 30분은 우리 곡 길이 분포에서 넉넉한 상한이다 — 이보다 긴 재생은 방치로 본다.
 */

/**
 * 겹 사용자 전체 조회 (S15P21A405-537, BACKEND-NOTES §5).
 *
 * **밀어 주는 이벤트가 없어서 주기로 다시 묻는다.** 백엔드가 제안한 10초를 그대로 쓴다 —
 * 격자 전체를 파이프라인 한 번으로 읽는 조회라 이 간격에서 부담이 되지 않는다고 적혀 있다.
 * 소켓 델타가 생기면(백엔드 후속) 이 폴링은 없어진다.
 */
export const LAYER_USERS = {
  pollMs: 10_000,
  /**
   * **"가깝다" 의 경계** — 내 곡에서 `k` 번째로 가까운 곡까지의 거리 (S15P21A405-541 · 596).
   * 한 겹에 곡이 1,000개(`LAYER_SONG_COUNT`) 이므로 대략 가까운 쪽 8% 다.
   *
   * PC 값에 고정 숫자를 안 쓰는 이유는 `lib/nearby-from-layer.ts` 의 `radiusFromNeighbors` 에
   * 적어 뒀다 — 겹마다 축의 퍼짐이 달라서 같은 숫자가 겹마다 다른 넓이를 뜻한다.
   *
   * **이 값을 키우면 더 멀리까지 뜬다.** 가까이 아무도 없을 때 패널이 비는 것이 맞다고 봤고
   * (S15P21A405-596), 너무 자주 빈다면 먼저 여기를 손보면 된다.
   */
  neighborK: 80,
  /**
   * 주변 사람 **패널에 뜨는 최대 인원**. 서버 설정(`realtime.nearby.panel-cap`)과 같은 값이다.
   *
   * **채우는 값이 아니라 넘지 않는 값이다.** 경계 안에 사람이 몰려 있을 때만 걸린다.
   *
   * **자르는 자리가 여기 하나뿐이다** (S15P21A405-582). 패널은 출처가 셋이라(서버 목록 · 겹
   * 조회 · 봇) 각자 자르면 합친 결과가 상한을 넘는다. 서버도 가까운 순으로 자르므로 합친 뒤
   * 같은 기준을 한 번 더 건다.
   *
   * **지도와는 무관하다.** 지도는 겹 조회를 따로 받아 층 사람을 다 그리고 겹친 사람은 묶는다
   * (`use-viewport-subscription`). 여기서 자른다고 지도에서 사라지지 않는다.
   *
   * 예전에 있던 `neighborK`(가깝다의 경계)는 걷어냈다 — 반경으로 자르는 일 자체가 없어졌다.
   */
  maxInPanel: 12,
} as const;

/**
 * 주변 사람 레이더 (S15P21A405-496).
 *
 * 패널 폭(우측 패널 376 - 좌우 여백)에 맞춘 값이다. 사람은 최대 10명이라
 * (`realtime.nearby.neighbor-k`) 이 크기에서 고르게 놓으면 겹치지 않는다.
 */
export const RADAR = {
  /** 정사각형 한 변(px). 우측 패널 폭(376) 안에 여백을 두고 들어간다 */
  size: 300,
  /**
   * 가장 가까운 사람을 가운데에서 이만큼 떨어뜨린다 (반지름 비율).
   *
   * **겹침이 여기서 갈린다.** 최악은 거리가 전부 같아 열 명이 안쪽 고리에 나란히 서는 경우다.
   * 그때 이웃 간격은 `2·r·sin(π/10)` 이고, 이 값이 헬멧 지름보다 커야 한다 —
   * `sizeMax` 50 을 넘기려면 반지름이 81px 이상이어야 해서 `0.54` 가 하한이다. 0.58 로 두어
   * 4px 쯤 여유를 남긴다. 처음에 0.34 로 뒀다가 실제로 27px 간격이 나와 겹쳤다.
   * (헬멧을 34~44 에서 38~50 으로 키우며 0.52 → 0.58 로 올렸다, S15P21A405-633)
   */
  ringMin: 0.58,
  /**
   * 가장 먼 사람의 자리. `1 - sizeMax/(2·size/2)` = 0.833 을 넘으면 테두리에서 잘린다.
   */
  ringMax: 0.82,
  /**
   * 헬멧 지름(px). 마주친 횟수가 0이거나 모두 같으면 전부 최소값이다.
   * 34~44 는 패널에서 작게 보여 38~50 으로 키웠다 (S15P21A405-633). 가운데 내 헬멧(`nearby-radar`)도 50 이다
   */
  sizeMin: 38,
  sizeMax: 50,
  /** 최대 만남 횟수의 이 비율을 넘는 사람만 숨쉰다 */
  breatheFrom: 0.6,
} as const;

/**
 * 따라가기 다시 잇기 (S15P21A405-615). 연결이 흔들려도 **내리지 않고** 다시 탑승을 시도한다 —
 * 내리는 것은 마지막 수단이다.
 */
export const RIDE_RESUME = {
  /**
   * 재시도 간격(ms). 합이 45초쯤이다 — presence TTL 과 같은 창이라, 인솔자가 새로고침 중이면
   * 이 안에 돌아온다. 그 뒤에도 안 되면 정말 없는 것으로 본다.
   */
  backoffMs: [3_000, 5_000, 8_000, 12_000, 17_000],
  /** 기다려도 달라지지 않는 거부 사유 — 이건 바로 내린다. 나머지(연결·인솔자 자리 비움·상태 어긋남·네트워크)는 다시 해 본다 */
  finalCodes: ["RIDE_SELF", "RIDE_CHAIN_FORBIDDEN", "RIDE_NOT_CAPTAIN", "RIDE_FULL"],
} as const;
