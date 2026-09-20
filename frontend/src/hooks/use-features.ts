"use client";

import { FEATURES, PANEL_ENABLED } from "@/constants";

/**
 * 지금 보여 줄 기능.
 *
 * **설문 모드를 따르지 않는다** (S15P21A405-480). 예전에는 설문 모드면 감춘 값, 끄면 전부 켠
 * 값을 줬다(S15P21A405-387). 이제 테스트 모드에서도 나머지 기능을 그대로 쓰기로 해서 갈릴
 * 것이 없다 — 모드가 가르는 것은 설문뿐이다.
 *
 * 훅을 남겨 두는 이유는 **단일 통로**여서다. 호출부 열 곳이 전부 여기를 거치므로, 다시
 * 무언가를 감추게 되면 [`FEATURES`](../constants/features.ts) 나 이 함수 한 군데만 고치면 된다.
 * 상수를 컴포넌트에서 직접 읽기 시작하면 그 길이 막힌다.
 */
export function useFeatures(): typeof FEATURES {
  return FEATURES;
}

/** 지금 열 수 있는 패널인가. {@link useFeatures} 와 같은 기준이다 */
export function usePanelEnabled(): Record<string, boolean> {
  return PANEL_ENABLED;
}
