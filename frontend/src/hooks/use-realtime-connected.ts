"use client";

import { useSyncExternalStore } from "react";
import { isConnected, onConnectionChange } from "@/lib/realtime/stomp-client";

/**
 * 소켓이 지금 붙어 있는가 — **구독한다** (S15P21A405-493).
 *
 * 예전에는 화면이 `isConnected()` 를 렌더 중에 그냥 불렀다. 그건 그 순간의 값일 뿐이라
 * 소켓이 나중에 붙어도 다시 렌더되지 않고, 화면은 **연결 안 됨으로 굳은 채** 아무 일도
 * 일어나지 않았다. 주변 사람 패널이 영원히 "불러오는 중" 이던 원인 중 하나다.
 *
 * 서버 스냅샷은 항상 false 다 — 소켓은 브라우저에만 있고, 서버가 그린 HTML 과 첫 렌더가
 * 달라지면 하이드레이션이 깨진다 (`auth-guard` 의 `useHasToken` 과 같은 방식).
 */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(onConnectionChange, isConnected, () => false);
}
