"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES, STORAGE_KEYS, TUTORIAL_STEPS } from "@/constants";
import { useCompleteTutorialMutation } from "@/hooks/mutations/use-complete-tutorial-mutation";
import { writeStorage } from "@/lib/storage";
import { useMapStore } from "@/stores/use-map-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import TutorialStepCard from "./tutorial-step-card";

/**
 * 단계별 태스크(확대·클릭=이동·재생·주변탐색·시작점 확정)를 주고 완료되면 다음으로.
 * 마지막 단계에서 지금 내 곡(재생/선택한 곡)을 시작점으로 저장하고 메인으로 이동.
 */
export default function TutorialOverlay() {
  const router = useRouter();
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const isDone = useTutorialStore((s) => s.isDone);
  const complete = useTutorialStore((s) => s.complete);
  const skip = useTutorialStore((s) => s.skip);
  const reset = useTutorialStore((s) => s.reset);
  const completeMutation = useCompleteTutorialMutation();

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!isDone) return;
    const { myMusicId, selectedMusicId } = useMapStore.getState();
    const start = myMusicId ?? selectedMusicId;
    if (start != null) writeStorage(STORAGE_KEYS.myMusicId, start);
    writeStorage(STORAGE_KEYS.tutorialDone, true);
    completeMutation.mutate(undefined, { onSettled: () => router.replace(ROUTES.home) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

  const step = TUTORIAL_STEPS[stepIndex];
  if (isDone || !step) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      <div className="pointer-events-auto absolute top-[120px] left-1/2 w-[min(340px,84vw)] -translate-x-1/2">
        <TutorialStepCard
          index={stepIndex}
          total={TUTORIAL_STEPS.length}
          title={step.title}
          description={step.description}
          onConfirm={step.task === "confirm" ? () => complete("confirm") : undefined}
          onSkip={skip}
        />
      </div>
    </div>
  );
}
