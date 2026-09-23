"use client";

import { useEffect, useState } from "react";

/**
 * 화면 아래에 쌓이는 HUD 조각의 **실제 높이**(px)를 잰다 (S15P21A405-417).
 *
 * 위에 얹히는 것들(패널·지도 가림폭)이 전부 이 높이 위에서 시작하는데, 높이는
 * **창 크기와 무관하게** 바뀐다 — 재생바는 곡이 없으면 한 줄, 재생 중이면 진행바가 한 줄 더
 * 붙는다. 탭바는 안전영역만큼 더 두꺼워진다. 상수로 박아 두면 그 차이만큼 위엣것이 붕 뜨거나
 * 겹친다. 실제로 96px 로 박아 뒀더니 곡이 없을 때 16px 이 비어 "네비가 뚝 끊겨 보인다" 고 나왔다.
 *
 * `resize` 가 아니라 `ResizeObserver` 인 이유가 그것이다 — 곡을 고르는 순간 늘어나는 것은
 * `resize` 로는 못 잡는다.
 *
 * **CSS 로 될 일에는 쓰지 않는다.** 여기서 나온 값은 자바스크립트가 숫자로 받아야 하는 곳
 * (지도 엔진의 가림폭)에만 쓰고, 자리 잡기는 `max-tablet:` 클래스가 한다 — 값을 인라인
 * 스타일로 내려보내면 화면이 넓어져도 그대로 남아 데스크톱을 망가뜨린다 (실제로 그랬다).
 */
function useBarHeight(selector: string, fallback: number) {
  const [height, setHeight] = useState(fallback);

  useEffect(() => {
    const bar = document.querySelector(selector);
    if (!bar) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      // 0 은 화면에서 빠지는 순간이다. 그때 값을 받아들이면 위엣것이 바닥에 붙었다 튄다
      if (h > 0) setHeight(h);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, [selector]);

  return height;
}

/** 재생바 높이. 곡이 없으면 한 줄, 재생 중이면 진행바가 붙어 더 높다 */
export function usePlayerBarHeight() {
  return useBarHeight("footer[data-hud]", 80);
}

/**
 * 폰 맨 아래 고정 탭바의 높이 — `--spacing-tabbar`(56) + 안전영역.
 * 데스크톱에서는 같은 요소가 우상단 알약이라 44 가 나오지만, 그쪽 가림폭은 이 값을 안 쓴다.
 */
export function useTabBarHeight() {
  return useBarHeight("[data-tabbar]", 56);
}
