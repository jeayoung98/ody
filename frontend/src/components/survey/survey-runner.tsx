"use client";

import { useEffect, useMemo } from "react";
import { useMapStore } from "@/stores/use-map-store";
import { usePlayerStore } from "@/stores/use-player-store";
import { useSurveyStore } from "@/stores/use-survey-store";
import { useSurveyTrigger } from "@/hooks/survey/use-survey-trigger";
import type { SurveyTarget } from "@/types/survey";
import SurveyCard from "./survey-card";

/**
 * 설문 본체 (S15P21A405-250).
 *
 * `SurveyGate` 가 **동적으로 불러온다** — 플래그가 꺼진 빌드에서는 이 모듈이 아예 로드되지
 * 않는다. 그래서 설문 관련 import(스토어·훅·카드)가 전부 이 경계 안에 있어야 한다.
 *
 * 의존은 한 방향이다 — 설문이 기존 스토어를 **읽기만** 한다. 기존 스토어는 설문을 모른다.
 *
 * **최종 배포 때 걷어낼 기능이다.**
 */
export default function SurveyRunner() {
  const currentMusicId = usePlayerStore((s) => s.currentMusicId);
  const context = usePlayerStore((s) => s.context);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const viewMode = useMapStore((s) => s.viewMode);
  const nearbyCenterMusicId = useMapStore((s) => s.nearbyCenterMusicId);
  const noteListened = useSurveyStore((s) => s.noteListened);

  /**
   * 곡별 청취 시간을 장부에 쌓는다.
   *
   * 비교 상대(앞 곡·기준곡)를 얼마나 들었는지 알려면 지나간 뒤에도 기록이 남아야 한다.
   * 곡이 바뀌는 순간(cleanup) 방금까지 듣던 곡의 체류 시간을 더한다 — 이 정리가
   * `useSurveyTrigger` 의 effect 보다 먼저 돌아서, 판단할 때는 최신값이 들어 있다.
   */
  useEffect(() => {
    if (currentMusicId == null) return;
    const from = Date.now();
    return () => noteListened(currentMusicId, Date.now() - from);
  }, [currentMusicId, noteListened]);

  /**
   * 지금 무엇을 평가해야 하는지 정한다.
   *
   * - 경로 재생 중이고 두 번째 곡부터면 → 방금 지난 **전환**을 묻는다
   * - 주변 탐색 뷰에서 기준곡이 아닌 곡을 듣고 있으면 → 기준곡과의 **유사도**를 묻는다
   * - 그 외(플레이리스트·단일 재생)는 알고리즘 평가 대상이 아니라 묻지 않는다
   */
  const target = useMemo<SurveyTarget | null>(() => {
    if (currentMusicId == null) return null;

    if (context.kind === "journey" && queueIndex > 0) {
      return {
        kind: "transition",
        musicId: currentMusicId,
        prevMusicId: queue[queueIndex - 1],
        startMusicId: context.startMusicId,
        endMusicId: context.endMusicId,
        position: queueIndex,
        totalStops: queue.length,
      };
    }

    if (viewMode === "nearby" && nearbyCenterMusicId != null && nearbyCenterMusicId !== currentMusicId) {
      return { kind: "nearby", musicId: currentMusicId, centerMusicId: nearbyCenterMusicId };
    }

    return null;
  }, [currentMusicId, context, queue, queueIndex, viewMode, nearbyCenterMusicId]);

  useSurveyTrigger(target);

  return <SurveyCard />;
}
