"use client";

import { useEffect, useState } from "react";

/** 아직 못 쟀을 때 쓸 값. 한 프레임만 쓰인다 */
const FALLBACK = 80;

/**
 * 재생바의 **실제 높이**(px)를 잰다 (S15P21A405-417).
 *
 * 아래에 서 있는 것들(네비·바텀시트)이 전부 재생바 위에 얹히는데, 재생바 높이는
 * **재생 상태에 따라 바뀐다** — 곡이 없으면 한 줄, 재생 중이면 진행바가 한 줄 더 붙는다.
 * 상수로 박아 두면 그 차이만큼 네비가 붕 뜨거나 겹친다. 실제로 96px 로 박아 뒀더니
 * 곡이 없을 때 16px 이 비어 "네비가 뚝 끊겨 보인다" 는 말이 나왔다.
 *
 * `ResizeObserver` 로 보는 이유는 높이가 **창 크기와 무관하게** 바뀌기 때문이다 —
 * 곡을 고르는 순간 늘어난다. `resize` 로는 그 순간을 못 잡는다.
 */
export function usePlayerBarHeight() {
  const [height, setHeight] = useState(FALLBACK);

  useEffect(() => {
    const bar = document.querySelector("footer[data-hud]");
    if (!bar) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      // 0 은 화면에서 빠지는 순간이다. 그때 값을 받아들이면 아래 것들이 바닥에 붙었다 튄다
      if (h > 0) setHeight(h);
    });
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  return height;
}
