"use client";

import { useSyncExternalStore } from "react";
import { BREAKPOINTS } from "@/constants/design-tokens";

const QUERY = `(max-width: ${BREAKPOINTS.tablet - 1}px)`;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  // 기기 에뮬레이션에서는 `change` 가 안 오는 경우가 있어 `resize` 도 같이 듣는다 (실측)
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * 지금이 **좁은 화면 배치**인가 (S15P21A405-417).
 *
 * 화면을 가르는 일은 원래 CSS 미디어 쿼리가 한다 — 이 훅은 **CSS 로 못 푸는 것**에만 쓴다.
 * 지도 엔진에 넘기는 가림폭이 그렇다: 폰에서 패널은 아래(바텀시트)에 서는데
 * `main-screen.tsx` 가 데스크톱 우측 패널 기준으로 "오른쪽 410px 이 가려졌다" 고 알려 주면,
 * 375px 화면에서 남는 폭이 최소치 120px 로 잘려 주변 탐색 고리가 구석에 찌그러진다 (실측).
 *
 * `useSyncExternalStore` 를 쓰는 이유는 두 가지다. 서버 스냅샷을 `false`(데스크톱)로 줘서
 * 하이드레이션이 어긋나지 않고, 값을 **렌더마다 다시 읽으므로** 이벤트가 한 번 빠져도
 * 다음 렌더에서 따라잡는다 — 이벤트만 듣는 구현은 에뮬레이션에서 영영 못 따라잡았다.
 */
export function useIsNarrow() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
