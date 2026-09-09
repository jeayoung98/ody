"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES, STORAGE_KEYS } from "@/constants";
import { useMeQuery } from "@/hooks/queries/use-me-query";
import { readStorage } from "@/lib/storage";

/**
 * 로컬 스토리지에 내 곡(=현재 위치)이 없고 서버의 tutorialCompleted 도 false 면 튜토리얼로 보낸다.
 * 튜토리얼은 "탐색 시작점"을 만들어주는 용도.
 */
export default function TutorialGate() {
  const router = useRouter();
  const { data: me } = useMeQuery();

  useEffect(() => {
    if (!me) return;
    const saved = readStorage<number>(STORAGE_KEYS.myMusicId);
    const doneLocally = readStorage<boolean>(STORAGE_KEYS.tutorialDone);
    if (saved == null && !me.tutorialCompleted && !doneLocally) router.replace(ROUTES.tutorial);
  }, [me, router]);

  return null;
}
