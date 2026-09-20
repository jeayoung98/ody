"use client";

import { useEffect } from "react";
import { STORAGE_KEYS } from "@/constants";
import { useFeatures } from "@/hooks/use-features";
import { connect, disconnect } from "@/lib/realtime/stomp-client";
import { readStorage, subscribeStorage } from "@/lib/storage";
import { usePresenceJoin } from "./use-presence-join";

/**
 * 실시간 전체의 시작점 (S15P21A405-482).
 *
 * **셋이 다 맞아야 연다** (명세 §0): `features.social` · 토큰 있음 · (연결되면) 소켓. 하나라도
 * 아니면 지도는 그냥 곡만 그린다 — 지금과 같은 화면이다.
 *
 * **토큰이 바뀌면 다시 연결한다** (§12.5). 소켓은 CONNECT 프레임에 토큰을 한 번 싣고 그대로
 * 유지되므로, 재발급만 하고 두면 REST 는 되는데 소켓은 옛 토큰으로 붙어 있는 어긋난 상태가
 * 된다. 저장소 구독으로 그 순간을 듣는다 — `lib/api.ts` 가 재발급하면 여기에 새 값을 쓴다.
 */
export function useRealtime(): void {
  const features = useFeatures();
  const social = features.social;

  useEffect(() => {
    if (!social) return;
    connect();
    // 토큰이 갈리면 stomp-client 가 옛 연결을 버리고 새 토큰으로 다시 연다
    const stop = subscribeStorage(() => {
      if (readStorage<string>(STORAGE_KEYS.accessToken)) connect();
      else void disconnect();
    });
    return () => {
      stop();
      void disconnect();
    };
  }, [social]);

  usePresenceJoin();
}
