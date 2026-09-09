"use client";

import { useCallback } from "react";
import { useJourneyStore } from "@/stores/use-journey-store";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 여정 지점을 고치는 유일한 통로 = 상단 확장 검색창 (JOURNEY-01).
 * 어디서 눌렀든 우측 패널은 닫고 확장 검색을 연다 — 검색창과 사이드 패널은 함께 뜨지 않는다.
 */
export function useOpenJourneyComposer() {
  const openComposer = useJourneyStore((s) => s.openComposer);
  const setPickTarget = useJourneyStore((s) => s.setPickTarget);
  const closePanel = usePanelStore((s) => s.close);

  return useCallback(
    (target?: "start" | "end") => {
      closePanel();
      openComposer();
      if (target) setPickTarget(target);
    },
    [closePanel, openComposer, setPickTarget],
  );
}
