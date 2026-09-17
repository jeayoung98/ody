"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { ROUTES, STORAGE_KEYS, TUTORIAL_STEPS } from "@/constants";
import { useCompleteTutorialMutation } from "@/hooks/mutations/use-complete-tutorial-mutation";
import { removeStorage } from "@/lib/storage";
import { useJourneyStore } from "@/stores/use-journey-store";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";
import { useTutorialStore } from "@/stores/use-tutorial-store";
import { StarHint, WheelHint } from "./tutorial-hint";
import TutorialSpotlight from "./tutorial-spotlight";
import TutorialOutro from "./tutorial-outro";
import TutorialStepCard from "./tutorial-step-card";
import { analyticsId, setAnalyticsContext, trackOnce } from "@/lib/analytics/client";

/** 안내 카드가 차지하는 세로 끝(px). 짚어 줄 별을 이보다 아래에서 고른다 */
const CARD_BOTTOM = 330;
/** 확대 단계를 통과할 배율. 들어올 때의 몇 배까지 확대해야 넘어가나 */
const ZOOM_STEP_RATIO = 3;
/** 첫 휠부터 이 시간이 지나야 넘어간다. 배율을 일찍 채워도 그 동안은 지도를 그냥 둘러보게 둔다 */
const ZOOM_EXPLORE_MS = 5000;

/** 안내 카드 자리. 그 단계에서 봐야 할 것을 안 가리는 쪽으로 비켜 준다 */
const CARD_AT = {
  top: "top-[120px] left-1/2 -translate-x-1/2",
  // 우측 패널을 보는 단계 — 가운데면 그 패널을 가린다
  left: "top-[120px] left-[24px]",
  // 지도 한가운데를 봐야 하는 단계 — 우측 패널 위로 비켜 준다
  right: "top-[76px] right-[90px]",
  bottom: "bottom-[92px] left-1/2 -translate-x-1/2",
} as const;

/**
 * 단계별 태스크(확대 · 짚어 준 별 누르기 · 주변 탐색 · 여정 세 단계)를 주고 완료되면 다음으로.
 * 마지막 단계의 마무리 화면 또는 건너뛰기를 거쳐 연습 상태를 비우고 메인으로 간다.
 */
export default function TutorialOverlay() {
  const stepIndex = useTutorialStore((s) => s.stepIndex);
  const isDone = useTutorialStore((s) => s.isDone);
  const complete = useTutorialStore((s) => s.complete);
  const skip = useTutorialStore((s) => s.skip);
  const reset = useTutorialStore((s) => s.reset);
  const { mutate: completeTutorial } = useCompleteTutorialMutation();
  /** 이 단계가 짚어 준 별. 단계가 바뀔 때마다 새로 고른다 */
  const [starId, setStarId] = useState<number | null>(null);
  const analyticsRun = useRef<string | null>(null);

  useEffect(() => {
    analyticsRun.current ??= analyticsId();
    setAnalyticsContext({ phase: "tutorial" });
    trackOnce(`tutorial:${analyticsRun.current}`, "tutorial_started", { tutorial_id: analyticsRun.current });
    trackOnce(`tutorial-step:${analyticsRun.current}`, "tutorial_step_viewed", { step: 0, task: TUTORIAL_STEPS[0].task });
    reset();
  }, [reset]);

  /**
   * 튜토리얼을 닫고 메인으로. 끝까지 한 경우에는 **마무리 화면을 한 번 거친 뒤** 여기로 온다
   * (S15P21A405-353) — 건너뛴 사람은 나가고 싶은 것이므로 바로 온다.
   *
   * **연습하며 만든 것은 전부 버린다** (S15P21A405-354). 듣던 곡도, 내 자리도, 만든 여정도
   * 남기지 않고 생 초기 상태에서 시작한다 — 튜토리얼은 손에 익히는 자리지 무언가를 고르는
   * 자리가 아니다. 남길 것은 "튜토리얼을 봤다" 는 사실 하나뿐이고, 그게 없으면 게이트가
   * 여기로 다시 보낸다.
   *
   * 스토어를 하나씩 되돌리는 대신 **통째로 다시 띄운다.** 지도 카메라·재생기·여정·패널이
   * 저마다 상태를 들고 있어서, 하나라도 빠뜨리면 "생 초기" 가 아니게 된다.
   */
  const finish = useCallback(() => {
    removeStorage(STORAGE_KEYS.myMusicId);
    removeStorage(STORAGE_KEYS.myHome);
    removeStorage(STORAGE_KEYS.playingMusicId);
    useTutorialStore.getState().finish();
    // Local completion is authoritative for navigation. Server sync is best effort
    // and uses keepalive, so a slow/offline API cannot trap the user in the outro.
    completeTutorial();
    window.location.replace(ROUTES.home);
  }, [completeTutorial]);

  const skipTutorial = () => {
    skip();
    finish();
  };

  /**
   * 출발곡·도착곡이 채워졌는지 본다. 채우는 길이 셋이라(상자에서 검색 · 지도 클릭 · 곡 상세의
   * "여정 출발점으로") 채우는 쪽마다 신호를 박지 않고 **결과**를 본다.
   *
   * `stepIndex` 도 의존성에 둔다 — 도착곡을 먼저 골라 둔 채 그 단계에 들어오면 바뀐 값이 없어
   * 영영 안 넘어간다. `complete` 는 지금 단계의 태스크와 다르면 아무것도 안 하므로 안전하다.
   */
  const startMusicId = useJourneyStore((s) => s.startMusicId);
  const endMusicId = useJourneyStore((s) => s.endMusicId);
  /**
   * 펼쳐진 화면을 보는 단계는 **여정으로 넘어가겠다고 직접 누를 때** 끝난다 (S15P21A405-354).
   * 누르는 길이 둘이라(만들기 상자가 바로 열리거나 여정 패널이 열리거나) 여기서도 결과를 본다.
   */
  const composerOpen = useJourneyStore((s) => s.isComposerOpen);
  const activePanel = usePanelStore((s) => s.activePanel);
  useEffect(() => {
    if (composerOpen || activePanel === "journey") complete("look");
    if (startMusicId != null) complete("journey-start");
    if (endMusicId != null) complete("journey-end");
  }, [composerOpen, activePanel, startMusicId, endMusicId, stepIndex, complete]);

  const step = TUTORIAL_STEPS[stepIndex];
  const needsStar = step?.hint === "star";

  /**
   * 확대 단계는 **휠 한 칸으로 끝나지 않는다** (S15P21A405-351). 확대가 어떤 느낌인지 겪기
   * 전에 넘어가 버리면 안내한 의미가 없다. 들어올 때 배율을 적어 두고 그 몇 배가 될 때까지 본다.
   *
   * 겹을 파고들면 카메라가 새 겹 기준으로 다시 잡혀 배율이 되돌아간다 — 그건 확대를 끝까지
   * 밀어붙인 것이니 그것대로 통과다.
   *
   * 배율만 보면 몇 초 만에 끝난다. 첫 휠부터 얼마간은 배율이 차 있어도 넘기지 않고 **그냥
   * 둔다** — 확대·이동으로 지도가 어떤 곳인지 훑어볼 시간이 이 단계의 목적이다.
   */
  const zooming = step?.task === "zoom";
  const [wheeled, setWheeled] = useState(false);
  useEffect(() => {
    if (!zooming) return;
    const layer0 = useMapStore.getState().layer;
    // 기준 배율은 **첫 틱에** 잡는다. 붙자마자 재면 엔진이 아직 첫 카메라를 맞추는 중이라 틀린다
    let k0 = 0;
    let firstWheelAt = 0;
    const onWheel = () => {
      if (!firstWheelAt) firstWheelAt = Date.now();
      setWheeled(true);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    const id = window.setInterval(() => {
      const e = getMapEngine();
      if (!e) return;
      if (!k0) return void (k0 = e.zoomK());
      /**
       * **다음 겹으로 넘어가려 들면 기다리지 않는다.** 벽에 닿아 압력을 밀고 있다는 것은
       * 확대를 끝까지 해 본 것이고, 거기서 더 붙잡아 두면 안내가 방해가 된다.
       */
      if ((e.pressure > 0 && e.pressureDir === 1) || useMapStore.getState().layer !== layer0) return void complete("zoom");
      if (!firstWheelAt || Date.now() - firstWheelAt < ZOOM_EXPLORE_MS) return;
      if (e.zoomK() >= k0 * ZOOM_STEP_RATIO) complete("zoom");
    }, 120);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("wheel", onWheel);
    };
  }, [zooming, complete]);

  /**
   * 짚을 별 하나를 고른다. **안 보이게 되면 다시 고른다** (S15P21A405-354) — 이 단계에서도
   * 확대·이동이 자유로우므로 짚어 둔 별이 화면 밖으로 나가 버릴 수 있고, 그러면 손짓만
   * 사라진 채 무엇을 누르라는 건지 알 수 없게 된다. 첫 프레임에 `visible` 이 비어 있는
   * 경우도 같은 되묻기로 넘어간다.
   */
  useEffect(() => {
    if (!needsStar) return;
    let cur: number | null = null;
    const id = window.setInterval(() => {
      const e = getMapEngine();
      if (!e || (cur != null && e.starPos(cur))) return;
      cur = e.pickTutorialStar(CARD_BOTTOM);
      setStarId(cur);
    }, 300);
    return () => window.clearInterval(id);
  }, [needsStar, stepIndex]);

  /**
   * 짚은 별을 눌렀다. 지도에서 별을 누른 것과 같게 처리하고(보기만 — 재생은 안 한다)
   * **바로** 주변 탐색 단계로 넘긴다. 곡 상세는 그 뒤로도 계속 떠 있다.
   */
  const pickStar = () => {
    if (starId == null) return;
    useMapStore.getState().selectMusic(starId);
    usePanelStore.getState().openSong(starId);
    getMapEngine()?.viewSong(starId);
    complete("select");
  };

  // 끝까지 했으면 마무리 화면을 한 장 띄운다. 거기서 눌러야 탐험이 시작된다
  if (isDone) return <TutorialOutro onStart={finish} />;
  if (!step) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {/*
        덤 먼저 — 안내 카드와 손짓이 그 위에 와야 한다. 덤은 아무것도 막지 않는다.
        확대 단계는 **휠을 유도하는 동안만** 덮는다 — 굴리기 시작하면 지도를 훑어보는
        시간이므로 걷어 준다. 다음 단계에서 다시 덮인다.
      */}
      {step.veil && !(zooming && wheeled) && <TutorialSpotlight spotlight={step.spotlight} />}
      {step.hint === "wheel" && !wheeled && <WheelHint />}
      {step.hint === "star" && starId != null && <StarHint musicId={starId} onPick={pickStar} />}
      <div className={`pointer-events-auto absolute w-[min(340px,84vw)] ${CARD_AT[step.card]}`}>
        <TutorialStepCard
          index={stepIndex}
          total={TUTORIAL_STEPS.length}
          title={step.title}
          description={step.description}
          // 누를 곳이 따로 없는 단계는 카드의 버튼으로 넘긴다 (여정 결과 보기)
          cta={step.cta || undefined}
          onConfirm={step.cta ? () => complete(step.task) : undefined}
          onSkip={skipTutorial}
        />
      </div>
    </div>
  );
}
