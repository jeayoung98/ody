"use client";

import { useCallback, useRef, type PointerEvent } from "react";
import { usePanelStore } from "@/stores/use-panel-store";

/** 접기·펴기로 쳐 주는 최소 거리(px). 이보다 짧으면 그냥 탭이거나 세로 스크롤의 흔들림이다 */
const DIST = 56;
/** 가로가 세로보다 이만큼 길어야 "옆으로 민 것" 으로 본다 — 목록을 세로로 굴릴 때 오작동하면 안 된다 */
const RATIO = 1.3;

/**
 * 폰에서 **옆으로 밀어 패널을 접었다 편다** (S15P21A405-417).
 *
 * 손잡이는 17px 짜리라 정확히 겨눠야 한다. 화면을 통째로 덮는 폰에서는 치우는 동작이 잦은데
 * 매번 그 혀를 찾아 누르게 할 일이 아니다 — 오른쪽으로 밀면 들어가고, 접힌 몸통(또는 손잡이)을
 * 왼쪽으로 밀면 나온다. **닫는 게 아니다.** 별자리·주변 탐색은 그대로 살아 있다.
 *
 * **마우스는 빼 둔다.** 데스크톱에서는 드래그가 글자 선택이고, 손잡이도 누르기 편하다.
 *
 * 세로 스크롤과 다투지 않게 두 가지를 본다: 가로가 세로보다 {@link RATIO} 배 길 것,
 * 그리고 {@link DIST} 이상 갈 것. `preventDefault` 는 하지 않는다 — 목록은 계속 굴러야 한다.
 */
export function usePanelSwipe() {
  const collapsed = usePanelStore((s) => s.collapsed);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const start = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) < DIST || Math.abs(dx) < Math.abs(dy) * RATIO) return;
      // 접힌 것을 오른쪽으로 더 밀거나, 펴진 것을 왼쪽으로 더 당기는 건 할 일이 없다
      if (dx > 0 === collapsed) {
        start.current = null;
        return;
      }
      start.current = null;
      toggleCollapsed();
    },
    [collapsed, toggleCollapsed],
  );

  const onPointerEnd = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
