"use client";

import { useEffect } from "react";
import { MOCK_FRIEND_REACTION_INTERVAL_MS, REACTIONS } from "@/constants";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { useReactionStore } from "@/stores/use-reaction-store";
import type { NearbyUser } from "@/types";

/**
 * 목 전용 — 지도에 떠 있는 사용자들이 스스로 반응을 쏘는 것처럼 보이게 한다 (SOCIAL-02).
 * 내 뷰 안에 실제로 잡혀 있는 사람 중에서만 고른다.
 * **백엔드 연동 시 이 훅은 소켓 `user:reaction` 수신 핸들러로 대체된다.**
 */
export function useMockFriendReactions(friends: NearbyUser[] | undefined) {
  const push = useReactionStore((s) => s.push);

  useEffect(() => {
    if (!friends?.length) return;
    const timer = setInterval(() => {
      const engine = getMapEngine();
      if (!engine) return;
      const onScreen = friends.filter((f) => engine.friendScreenPos(f.email));
      if (onScreen.length === 0) return;
      const who = onScreen[Math.floor(Math.random() * onScreen.length)];
      const what = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
      push({ reactionKey: what.key, mine: false, fromEmail: who.email, nickname: who.nickname });
    }, MOCK_FRIEND_REACTION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [friends, push]);
}
