"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { ROUTES, STORAGE_KEYS, TUTORIAL_STEPS } from "@/constants";
import { useCompleteTutorialMutation } from "@/hooks/mutations/use-complete-tutorial-mutation";
import { writeStorage } from "@/lib/storage";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import TutorialSpotlight from "./tutorial-spotlight";
import TutorialStepCard from "./tutorial-step-card";

/** 안내 카드가 차지하는 세로 끝(px). 짚어 줄 별을 이보다 아래에서 고른다 */
const CARD_BOTTOM = 330;

/**
 * 단계별 태스크(확대 · 짚어 준 별 누르기 · 주변 탐색 · 여정 세 단계)를 주고 완료되면 다음으로.
 * 마지막 단계가 끝나면 지금 내 곡(재생/선택한 곡)을 시작점으로 저장하고 메인으로 간다.
 */
export default function TutorialOverlay() {
  const router = useRouter();
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const isDone = useTutorialStore((s) => s.isDone);
  const complete = useTutorialStore((s) => s.complete);
  const skip = useTutorialStore((s) => s.skip);
  const reset = useTutorialStore((s) => s.reset);
  const completeMutation = useCompleteTutorialMutation();
  /** 이 단계가 짚어 준 별. 단계가 바뀔 때마다 새로 고른다 */
  const [starId, setStarId] = useState<number | null>(null);

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

  /**
   * 출발곡·도착곡이 채워졌는지 본다. 채우는 길이 셋이라(상자에서 검색 · 지도 클릭 · 곡 상세의
   * "여정 출발점으로") 채우는 쪽마다 신호를 박지 않고 **결과**를 본다.
   *
   * `stepIndex` 도 의존성에 둔다 — 도착곡을 먼저 골라 둔 채 그 단계에 들어오면 바뀐 값이 없어
   * 영영 안 넘어간다. `complete` 는 지금 단계의 태스크와 다르면 아무것도 안 하므로 안전하다.
   */
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  useEffect(() => {
    if (startMusicId != null) complete("journey-start");
    if (endMusicId != null) complete("journey-end");
  }, [startMusicId, endMusicId, stepIndex, complete]);

  const step = TUTORIAL_STEPS[stepIndex];
  const needsStar = !!step && (step.spotlight as readonly string[]).includes("star");

  /**
   * 짚을 별 하나를 고른다. 별이 아직 안 그려졌을 수 있어 한 번 실패하면 다시 묻는다 —
   * 첫 프레임에는 `visible` 이 비어 있다.
   */
  useEffect(() => {
    if (!needsStar) return;
    let id = window.setTimeout(function pick() {
      const chosen = getMapEngine()?.pickTutorialStar(CARD_BOTTOM) ?? null;
      if (chosen != null) setStarId(chosen);
      else id = window.setTimeout(pick, 200);
    }, 0);
    return () => window.clearTimeout(id);
  }, [needsStar, stepIndex]);

  /**
   * 지도 조작을 막는 단계 (`lock`). 어둠막은 그 위를 지나는 휠만 막을 뿐, 뚫어 놓은 구멍
   * 위에서는 그대로 통한다 — 짚어 준 별을 누르는 것 말고는 아무것도 안 되게 하려면 휠 자체를
   * 잡아야 한다. 캡처 단계에서 멈추므로 지도의 `onWheel` 까지 가지 않는다.
   */
  const locked = !!step?.lock;
  useEffect(() => {
    if (!locked) return;
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("wheel", block, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", block, { capture: true });
  }, [locked]);

  if (isDone || !step) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {/* 보여 주기만 하는 단계는 덮지 않는다. 아무 데나 누르면 넘어간다 */}
      {step.free ? (
        <button
          type="button"
          aria-label="계속"
          className="pointer-events-auto absolute inset-0 cursor-pointer"
          onClick={() => complete("look")}
        />
      ) : (
        /* 어둠막 먼저 — 안내 카드가 그 위에 와야 건너뛰기가 눌린다 */
        <TutorialSpotlight spotlight={step.spotlight} ringOnly={step.ringOnly} starId={needsStar ? starId : null} hint={step.hint} />
      )}
      <div
        className={`pointer-events-auto absolute left-1/2 w-[min(340px,84vw)] -translate-x-1/2 ${
          // 여정은 우측 패널을 보며 하는 단계다 — 카드가 위에 있으면 그 패널을 가린다
          step.card === "bottom" ? "bottom-[92px]" : "top-[120px]"
        }`}
      >
        <TutorialStepCard index={stepIndex} total={TUTORIAL_STEPS.length} title={step.title} description={step.description} onSkip={skip} />
      </div>
    </div>
  );
}
