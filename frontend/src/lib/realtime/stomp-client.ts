"use client";

import { Client, type IMessage } from "@stomp/stompjs";
import { REALTIME, STORAGE_KEYS, wsOrigin } from "@/constants";
import { readStorage } from "@/lib/storage";
import type { RealtimeMessage, RealtimeMessageType } from "@/types";

/**
 * 실시간 소켓 하나 (S15P21A405-482, 실시간 작업명세 §2·§12).
 *
 * **앱 전체에 클라이언트 하나만 둔다.** 지도·패널이 각자 열면 서로의 구독을 덮는다. 그래서
 * 모듈 스코프 싱글턴이고, 훅들은 `subscribe()` 로 같은 흐름을 나눠 듣는다.
 *
 * 여기서 막는 함정들 (전부 실측에서 나온 것이고 서버가 봐주지 않는다):
 * - **재연결하면 `seq` 가 1부터 다시 온다** (§12.2). 초기화를 안 하면 새 연결의 정상 프레임이
 *   전부 "옛날 것"으로 걸러져 화면이 통째로 안 그려진다. 오류도 안 뜨는 가장 찾기 어려운 종류다.
 * - **요청이 실패해도 아무 응답이 안 올 수 있다** (§12.3). REST 와 달리 4xx 가 오지 않고 오류
 *   큐도 조용하다. 그래서 `expect()` 로 타임아웃을 건다.
 * - **재연결하면 서버 쪽 구독이 없다** (§12.4). join → viewport → nearby 를 다시 보내야 한다.
 * - **토큰을 재발급하면 소켓은 옛 토큰으로 붙어 있다** (§12.5). CONNECT 때 한 번 싣고 유지되기
 *   때문이다. REST 만 복구되고 소켓은 어긋난 상태가 되므로 끊고 다시 연결한다.
 */

type Listener = (msg: RealtimeMessage<unknown>) => void;

/** 연결이 열리고 닫힐 때 알린다 — 훅이 "붙었으니 다시 보내라" 를 이걸로 안다 */
type ConnectListener = (connected: boolean) => void;

let client: Client | null = null;
let connected = false;
/** CONNECT 에 실어 보낸 토큰. 이게 지금 저장소 값과 다르면 재발급된 것이다 (§12.5) */
let connectedWith: string | null = null;

/**
 * 마지막으로 처리한 봉투 `seq`.
 *
 * **한 연결 안에서만 유효하다.** 연결이 열릴 때 0 으로 되돌린다 (§12.2).
 */
let lastSeq = 0;

const listeners = new Set<Listener>();
const connectListeners = new Set<ConnectListener>();

/** 응답을 기다리는 요청들. 키는 우리가 정한 이름이고, 값은 타임아웃 타이머다 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function token(): string | null {
  return readStorage<string>(STORAGE_KEYS.accessToken) ?? null;
}

function resetForNewConnection() {
  lastSeq = 0;
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}

function handleFrame(frame: IMessage) {
  let msg: RealtimeMessage<unknown>;
  try {
    msg = JSON.parse(frame.body) as RealtimeMessage<unknown>;
  } catch {
    // 봉투가 아니면 우리가 아는 메시지가 아니다. 던지면 STOMP 구독이 끊긴다
    return;
  }
  /**
   * **오래된 프레임은 버린다.** 다만 `seq` 가 없는(0·undefined) 프레임은 거르지 않는다 —
   * 오류 프레임처럼 순번을 안 매겨 보내는 경우가 있고, 그걸 버리면 원인 표시가 사라진다.
   */
  if (typeof msg.seq === "number" && msg.seq > 0) {
    if (msg.seq <= lastSeq) return;
    lastSeq = msg.seq;
  }
  for (const listen of listeners) listen(msg);
}

function ensureClient(): Client | null {
  const auth = token();
  if (!auth) return null;

  // 토큰이 바뀌었으면 옛 토큰으로 붙은 소켓을 버린다 (§12.5)
  if (client && connectedWith && connectedWith !== auth) {
    void disconnect();
  }
  if (client) return client;

  const origin = wsOrigin();
  if (!origin) return null;

  connectedWith = auth;
  client = new Client({
    brokerURL: `${origin}${REALTIME.ws.path}`,
    connectHeaders: { Authorization: `Bearer ${auth}` },
    reconnectDelay: REALTIME.reconnectDelayMs,
    // 서버가 heartbeat 를 쓰지 않는다 — 우리는 /app/presence/heartbeat 로 따로 보낸다
    heartbeatIncoming: 0,
    heartbeatOutgoing: 0,
    onConnect: () => {
      resetForNewConnection();
      client?.subscribe(REALTIME.queue.presence, handleFrame);
      client?.subscribe(REALTIME.queue.errors, handleFrame);
      connected = true;
      // 구독이 끝난 뒤에 알린다 — 듣는 쪽이 여기서 join → viewport 를 보낸다 (§12.4)
      for (const listen of connectListeners) listen(true);
    },
    onWebSocketClose: () => {
      if (!connected) return;
      connected = false;
      for (const listen of connectListeners) listen(false);
    },
  });
  client.activate();
  return client;
}

/** 소켓을 연다. 토큰이 없으면 아무것도 하지 않는다 — 실시간 전체가 로그인 뒤에만 돈다 */
export function connect(): void {
  ensureClient();
}

export async function disconnect(): Promise<void> {
  const old = client;
  client = null;
  connected = false;
  connectedWith = null;
  resetForNewConnection();
  await old?.deactivate();
}

export function isConnected(): boolean {
  return connected;
}

/** 모든 수신 프레임을 듣는다. 해제 함수를 돌려준다 */
export function subscribe(listen: Listener): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/** 연결이 열리고 닫히는 것을 듣는다. **열릴 때마다** 호출되므로 재연결 복구를 여기 건다 */
export function onConnectionChange(listen: ConnectListener): () => void {
  connectListeners.add(listen);
  if (connected) listen(true);
  return () => connectListeners.delete(listen);
}

/** 보낸다. 연결 전이면 조용히 버린다 — 연결되면 훅이 다시 보낸다 (§12.4) */
export function send(destination: string, body?: unknown): boolean {
  if (!connected || !client) return false;
  client.publish({ destination, body: body === undefined ? "" : JSON.stringify(body) });
  return true;
}

/**
 * 응답을 기다린다 (§12.3). `key` 는 우리가 정한 이름이고, 같은 키로 다시 부르면 이전 것을 지운다.
 *
 * 소켓은 실패해도 조용할 수 있어서, 응답이든 오류든 아무것도 안 오면 `onTimeout` 이 돈다.
 * 무한정 도는 스피너를 만들지 않기 위한 장치다.
 */
export function expect(key: string, onTimeout: () => void): void {
  settle(key);
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      onTimeout();
    }, REALTIME.requestTimeoutMs),
  );
}

/** 기다리던 응답이 왔다 — 타임아웃을 끈다 */
export function settle(key: string): void {
  const timer = pending.get(key);
  if (timer) {
    clearTimeout(timer);
    pending.delete(key);
  }
}

/** 타입으로 좁혀 듣는 편의 함수 */
export function onType<T>(types: readonly RealtimeMessageType[], handle: (payload: T, msg: RealtimeMessage<T>) => void): () => void {
  return subscribe((msg) => {
    if (types.includes(msg.type)) handle(msg.payload as T, msg as RealtimeMessage<T>);
  });
}
