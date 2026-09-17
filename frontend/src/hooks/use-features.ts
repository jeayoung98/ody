"use client";

import { ALL_FEATURES, ALL_PANELS, FEATURES, PANEL_ENABLED } from "@/constants";
import { useSurveyMode } from "./use-survey-mode";

/**
 * 지금 보여 줄 기능 (S15P21A405-387).
 *
 * 유저 테스트 동안 감춰 둔 것들([`FEATURES`](../constants/features.ts), S15P21A405-333)은
 * 빌드타임 환경변수라 배포본에서 못 켰다. 그래서 설문 모드를 꺼도 레일의 마이페이지·주변
 * 사람·차트 탭이 계속 안 보였다 — **배포본에서 팀원이 개발 버전을 보라고 만든 모드인데
 * 정작 개발 중인 화면으로 들어갈 입구가 닫혀 있었다.**
 *
 * 이제 [`useSurveyMode`](./use-survey-mode.ts) 를 따른다. 설문 모드면 감춘 값, 끄면 전부 켠 값.
 *
 * ```js
 * localStorage.setItem("ody:survey-mode", "false"); location.reload();  // 전부 보인다
 * localStorage.removeItem("ody:survey-mode");       location.reload();  // 감춘다 (기본)
 * ```
 *
 * 환경변수(`NEXT_PUBLIC_FEATURE_*`)는 그대로 살아 있다 — 설문 모드인 채로 **하나만** 켜 보고
 * 싶을 때 쓴다. 모드를 끄면 어차피 전부 켜지므로 그때는 무의미하다.
 *
 * **상수를 직접 import 하지 않는다.** `FEATURES.social` 을 그대로 읽으면 모드를 안 따라서,
 * 같은 화면인데 어떤 자리는 열리고 어떤 자리는 닫히는 상태가 된다.
 */
export function useFeatures(): typeof FEATURES {
  return useSurveyMode() ? FEATURES : ALL_FEATURES;
}

/** 지금 열 수 있는 패널인가. {@link useFeatures} 와 같은 기준이다 */
export function usePanelEnabled(): Record<string, boolean> {
  return useSurveyMode() ? PANEL_ENABLED : ALL_PANELS;
}
