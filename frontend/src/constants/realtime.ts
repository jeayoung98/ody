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
  },
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
export const PLAY_END = { maxMs: 30 * 60 * 1000 } as const;

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
   * `sizeMax` 44 를 넘기려면 반지름이 75px 이상이어야 해서 `0.50` 이 하한이다. 0.52 로 두어
   * 4px 쯤 여유를 남긴다. 처음에 0.34 로 뒀다가 실제로 27px 간격이 나와 겹쳤다.
   */
  ringMin: 0.52,
  /**
   * 가장 먼 사람의 자리. `1 - sizeMax/(2·size/2)` = 0.853 을 넘으면 테두리에서 잘린다.
   */
  ringMax: 0.84,
  /** 헬멧 지름(px). 마주친 횟수가 0이거나 모두 같으면 전부 최소값이다 */
  sizeMin: 34,
  sizeMax: 44,
  /** 최대 만남 횟수의 이 비율을 넘는 사람만 숨쉰다 */
  breatheFrom: 0.6,
} as const;
