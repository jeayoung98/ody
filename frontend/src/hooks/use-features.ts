"use client";

import { FEATURES, PANEL_ENABLED, SURVEY_FEATURES, SURVEY_PANEL_ENABLED } from "@/constants";
import { useSurveyMode } from "./use-survey-mode";

/**
 * 지금 보여 줄 기능.
 *
 * **설문 모드면 랭킹을 감춘다** (S15P21A405-570). 한동안은 모드를 아예 안 봤다 —
 * S15P21A405-480 에서 감추는 축을 걷어냈기 때문이다. 다만 그때 이 통로는 남겨 뒀고,
 * 이번에 랭킹 하나를 다시 감추면서 그 길을 그대로 썼다.
 *
 * 호출부 열 곳이 전부 여기를 거치므로 감출 것이 또 생겨도 여기와
 * [`FEATURES`](../constants/features.ts) 만 고치면 된다. 상수를 컴포넌트에서 직접 읽기
 * 시작하면 그 길이 막힌다.
 */
export function useFeatures(): typeof FEATURES {
  return useSurveyMode() ? SURVEY_FEATURES : FEATURES;
}

/**
 * 지금 열 수 있는 패널인가. {@link useFeatures} 와 같은 기준이다.
 *
 * 둘 다 **미리 만들어 둔 객체**를 돌려준다. 여기서 `{...}` 를 새로 지으면 `useSurveyMode` 의
 * `useSyncExternalStore` 가 스냅샷이 매번 바뀐 것으로 보고 무한 렌더에 빠진다.
 */
export function usePanelEnabled(): Record<string, boolean> {
  return useSurveyMode() ? SURVEY_PANEL_ENABLED : PANEL_ENABLED;
}
