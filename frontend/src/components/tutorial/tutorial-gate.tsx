"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { readStorage } from "@/lib/storage";
import { useTutorialStore } from "@/stores/use-tutorial-store";

/**
 * 완료/건너뛰기 기록을 로컬 또는 서버에서 복원한다.
 * 완료 기록도 기존 시작점도 없는 사용자만 튜토리얼로 보낸다.
 */
export default function TutorialGate() {
  const router = useRouter();
  const { data: me } = useMeQuery();

  useEffect(() => {
    // Local completion/skip wins even while /me is loading or has failed.
    if (useTutorialStore.getState().hydrateCompletion(me?.tutorialCompleted)) return;
    if (!me) return;
    const saved = readStorage<number>(STORAGE_KEYS.myMusicId);
    if (saved == null) router.replace(ROUTES.tutorial);
  }, [me, router]);

  return null;
}
