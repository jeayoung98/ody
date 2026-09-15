"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { ROUTES, STORAGE_KEYS, TUTORIAL_STEPS } from "@/constants";
import { useCompleteTutorialMutation } from "@/hooks/mutations/use-complete-tutorial-mutation";
import { writeStorage } from "@/lib/storage";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { StarHint, WheelHint } from "./tutorial-hint";
import TutorialSpotlight from "./tutorial-spotlight";
import TutorialStepCard from "./tutorial-step-card";

/** 안내 카드가 차지하는 세로 끝(px). 짚어 줄 별을 이보다 아래에서 고른다 */
const CARD_BOTTOM = 330;
/** 확대 단계를 통과할 배율. 들어올 때의 몇 배까지 확대해야 넘어가나 */
const ZOOM_STEP_RATIO = 1.8;
/** 별을 누른 뒤 곡 상세를 보여 주는 시간(ms). 이 동안은 덮지 않는다 */
const DETAIL_PEEK_MS = 2000;

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
  /** 짚은 별을 눌렀나. 누른 뒤에는 곡 상세를 볼 수 있게 덮지 않는다 */
  const [picked, setPicked] = useState(false);

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
  const needsStar = step?.hint === "star";

  /**
   * 확대 단계는 **휠 한 칸으로 끝나지 않는다** (S15P21A405-351). 확대가 어떤 느낌인지 겪기
   * 전에 넘어가 버리면 안내한 의미가 없다. 들어올 때 배율을 적어 두고 그 몇 배가 될 때까지 본다.
   *
   * 겹을 파고들면 카메라가 새 겹 기준으로 다시 잡혀 배율이 되돌아간다 — 그건 확대를 끝까지
   * 밀어붙인 것이니 그것대로 통과다.
   */
  const zooming = step?.task === "zoom";
  const [wheeled, setWheeled] = useState(false);
  useEffect(() => {
    if (!zooming) return;
    const layer0 = useMapStore.getState().layer;
    // 기준 배율은 **첫 틱에** 잡는다. 붙자마자 재면 엔진이 아직 첫 카메라를 맞추는 중이라 틀린다
    let k0 = 0;
    const onWheel = () => setWheeled(true);
    window.addEventListener("wheel", onWheel, { passive: true });
    const id = window.setInterval(() => {
      const e = getMapEngine();
      if (!e) return;
      if (!k0) return void (k0 = e.zoomK());
      if (e.zoomK() >= k0 * ZOOM_STEP_RATIO || useMapStore.getState().layer !== layer0) complete("zoom");
    }, 120);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("wheel", onWheel);
    };
  }, [zooming, complete]);

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

  /**
   * 짚은 별을 눌렀다. 지도에서 별을 누른 것과 같게 처리하고(보기만 — 재생은 안 한다),
   * **곡 상세를 볼 틈을 준 뒤** 주변 탐색 단계로 넘긴다. 그 동안은 덮지 않는다.
   */
  const pickStar = () => {
    if (starId == null || picked) return;
    setPicked(true);
    useMapStore.getState().selectMusic(starId);
    usePanelStore.getState().openSong(starId);
    getMapEngine()?.viewSong(starId);
    window.setTimeout(() => complete("select"), DETAIL_PEEK_MS);
  };

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
        /* 어둠막 먼저 — 안내 카드가 그 위에 와야 건너뛰기가 눌린다.
           휠을 굴리기 전 확대 단계와, 별을 눌러 상세를 보는 동안에는 덮지 않는다 */
        !(zooming || picked) && <TutorialSpotlight spotlight={step.spotlight} ringOnly={step.ringOnly} />
      )}
      {step.hint === "wheel" && !wheeled && <WheelHint />}
      {step.hint === "star" && starId != null && !picked && <StarHint musicId={starId} onPick={pickStar} />}
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
