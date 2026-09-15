"use client";

import { useState } from "react";
import { STORAGE_KEYS, TEST_MODE } from "@/constants";
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
  const [seen, setSeen] = useState<boolean | null>(null);

  // 첫 클라이언트 렌더에서 한 번만 읽는다. null 인 동안에는 아무것도 안 그린다
  if (seen === null && typeof window !== "undefined") {
    setSeen(!TEST_MODE || readStorage<boolean>(STORAGE_KEYS.testGuideSeen) === true);
  }

  if (seen === null) return null;
  if (!seen) {
    return (
      <TestGuide
        onStart={() => {
          writeStorage(STORAGE_KEYS.testGuideSeen, true);
          setSeen(true);
        }}
      />
    );
  }
  return <TutorialOverlay />;
}
