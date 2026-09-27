"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { readStorage } from "@/lib/storage";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { setAnalyticsContext, trackOnce } from "@/lib/analytics/client";

/**
 * 완료/건너뛰기 기록을 로컬 또는 서버에서 복원한다.
 * 완료 기록도 기존 시작점도 없는 사용자만 튜토리얼로 보낸다.
 */
export default function TutorialGate() {
  const router = useRouter();
  const { data: me, isPending } = useMeQuery();

  useEffect(() => {
    // Local completion/skip wins even while /me is loading or has failed.
    if (useTutorialStore.getState().hydrateCompletion(me?.tutorialCompleted)) {
      setAnalyticsContext({ phase: "free" });
      trackOnce("free-explore", "free_explore_started");
      return;
    }
    /**
     * 아직 답을 기다리는 동안만 미룬다. **`me` 가 없다는 것으로 미루면 안 된다** —
     * 계정 없이 도는 설문 모드에서는 `/me` 가 401 로 끝나서(S15P21A405-462) 영영 오지 않고,
     * 그러면 처음 온 테스터가 튜토리얼로 못 간다.
     */
    if (isPending) return;
    const saved = readStorage<number>(STORAGE_KEYS.myMusicId);
    if (saved == null) router.replace(ROUTES.tutorial);
    else {
      setAnalyticsContext({ phase: "free" });
      trackOnce("free-explore", "free_explore_started");
    }
  }, [me, isPending, router]);

  return null;
}
