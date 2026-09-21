"use client";

import { useCallback, useRef, type PointerEvent } from "react";
import { usePanelStore } from "@/stores/use-panel-store";

/** 접기·펴기로 쳐 주는 최소 거리(px). 이보다 짧으면 그냥 탭이거나 세로 스크롤의 흔들림이다 */
const DIST = 56;
/** 세로가 가로보다 이만큼 길어야 "위아래로 민 것" 으로 본다 */
const RATIO = 1.3;

/**
 * 폰에서 **위아래로 밀어 시트를 접었다 편다** (S15P21A405-417).
 *
 * 폰의 곡 상세·여정·플리는 아래에서 올라오는 **바텀시트**다. 내리면 제목 줄만 남기고
 * (`--spacing-sheet-peek`) 지도가 드러나고, 올리면 화면을 채운다. **닫는 게 아니다** —
 * 별자리·주변 탐색은 그대로 살아 있고 시트만 미끄러진다.
 *
 * **마우스는 빼 둔다.** 데스크톱에서 패널은 옆으로 접히고, 드래그는 글자 선택이다.
 *
 * 목록의 세로 스크롤과 다투지 않게 두 가지를 본다: 세로가 가로보다 {@link RATIO} 배 길 것,
 * {@link DIST} 이상 갈 것. 그리고 **내용이 위로 더 굴러갈 수 있으면 넘긴다** — 목록 한가운데서
 * 아래로 당기는 것은 스크롤이지 시트를 내리라는 뜻이 아니다. `preventDefault` 는 하지 않는다.
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
      if (Math.abs(dy) < DIST || Math.abs(dy) < Math.abs(dx) * RATIO) return;
      // 접힌 것을 더 내리거나, 펼친 것을 더 올리는 건 할 일이 없다
      if (dy > 0 === collapsed) {
        start.current = null;
        return;
      }
      // 펼친 상태에서 아래로 당길 때, 목록이 아직 위로 굴러 있으면 그건 스크롤이다
      if (dy > 0) {
        const scroller = (e.target as HTMLElement).closest<HTMLElement>(".scroll-quiet, [data-sheet-scroll]");
        if (scroller && scroller.scrollTop > 0) return;
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
