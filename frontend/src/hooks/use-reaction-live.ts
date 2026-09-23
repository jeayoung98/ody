"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants";
import { onType } from "@/lib/realtime/stomp-client";
import { useReactionStore } from "@/stores/use-reaction-store";
import type { NearbySnapshot, ReactionPayload } from "@/types";

/**
 * 남이 나에게 보낸 반응 — 개인 큐 `REACTION` (SOCIAL-02, S15P21A405-607).
 * 보낸 사람 위치 위에 이모지를 띄운다. 닉네임은 서버가 안 실어 주므로 주변 사람 목록에서 찾는다.
 * 소켓과 같은 수명이라 `useRealtime` 에 건다.
 */
export function useReactionLive(): void {
  const qc = useQueryClient();
  useEffect(
    () =>
      onType<ReactionPayload>(["REACTION"], (p) => {
        const who = qc.getQueryData<NearbySnapshot>(QUERY_KEYS.realtime.nearby)?.people.find((x) => x.email === p.fromEmail);
        useReactionStore.getState().push({
          reactionKey: p.reactionKey,
          mine: false,
          fromEmail: p.fromEmail,
          nickname: who?.nickname,
        });
      }),
    [qc],
  );
}
