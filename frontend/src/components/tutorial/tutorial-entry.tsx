"use client";

import { useState, useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/constants";
import { useSurveyMode } from "@/hooks/use-survey-mode";
import { readStorage, writeStorage } from "@/lib/storage";
import TestGuide from "./test-guide";
import TutorialOverlay from "./tutorial-overlay";

/**
 * 튜토리얼 입구 (S15P21A405-343).
 *
 * 테스트 모드면 **안내 화면을 한 장 먼저** 보여 주고, 읽고 시작하면 튜토리얼로 넘어간다.
 * 모드가 꺼져 있으면 예전처럼 바로 튜토리얼이다.
 *
 * 처음 그릴 때 localStorage 를 읽지 않는다 — 서버 렌더와 값이 달라 하이드레이션이 깨진다.
 * 클라이언트가 붙은 뒤 한 번 읽어 결정한다 (`use-player-store` 의 `restoreLast` 와 같은 이유).
 */
export default function TutorialEntry() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  // 설문 모드를 끈 브라우저에서는 안내 화면도 건너뛴다 (S15P21A405-383)
  const surveyMode = useSurveyMode();
  const [started, setStarted] = useState(false);

  // getServerSnapshot=false라 서버와 첫 클라이언트 렌더는 둘 다 비어 있다.
  // hydration 뒤에만 storage를 읽어 오버레이 트리가 먼저 생기는 오류를 막는다.
  const seen = hydrated
    ? started || !surveyMode || readStorage<boolean>(STORAGE_KEYS.testGuideSeen) === true
    : null;

  if (seen === null) return null;
  if (!seen) {
    return (
      <TestGuide
        onStart={() => {
          writeStorage(STORAGE_KEYS.testGuideSeen, true);
          setStarted(true);
        }}
      />
    );
  }
  return <TutorialOverlay />;
}
