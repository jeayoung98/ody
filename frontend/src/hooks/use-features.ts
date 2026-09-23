"use client";

import { FEATURES, PANEL_ENABLED } from "@/constants";

/**
 * 지금 보여 줄 기능.
 *
 * **설문 모드를 보지 않는다** (S15P21A405-612). 그 모드는 설문(과 테스트 안내 화면)만 가른다 —
 * 한동안 랭킹을 감추는 데도 썼는데(S15P21A405-570) 콘테스트가 딸려 꺼지면서 축을 걷어냈다.
 *
 * 그래도 훅으로 남겨 둔 이유: 호출부 열 곳이 전부 여기를 거치므로 무언가를 다시 감출 일이 생기면
 * 여기와 [`FEATURES`](../constants/features.ts) 만 고치면 된다. 상수를 컴포넌트에서 직접 읽기
 * 시작하면 그 길이 막힌다.
 */
export function useFeatures(): typeof FEATURES {
  return FEATURES;
}

/** 지금 열 수 있는 패널인가. {@link useFeatures} 와 같은 기준이다 */
export function usePanelEnabled(): Record<string, boolean> {
  return PANEL_ENABLED;
}
