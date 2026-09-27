"use client";

import { useCallback, useRef, type PointerEvent } from "react";

/** 넘김으로 쳐 주는 최소 거리(px). 이보다 짧으면 탭이거나 세로 스크롤의 흔들림이다 */
const DIST = 48;
/** 가로가 세로보다 이만큼 길어야 "옆으로 민 것" 으로 본다 */
const RATIO = 1.3;

/**
 * **옆으로 밀어 장을 넘긴다** (S15P21A405-532).
 *
 * ODY 가이드는 화살표 버튼으로만 넘길 수 있었다. 폰에서 여러 장짜리 카드는 미는 것이
 * 기본 문법이고, 화살표는 모서리에 작게 있어서 손가락으로 겨누기도 나쁘다.
 *
 * **마우스는 빼 둔다** — 데스크톱에서 끄는 동작은 글자 선택이다. 화살표와 키보드 좌우는
 * 그대로 두므로 데스크톱 동작은 하나도 바뀌지 않는다 ({@link usePanelSwipe} 와 같은 이유).
 *
 * 세로 스크롤과 다투지 않게 둘을 본다: 가로가 세로보다 {@link RATIO} 배 길 것,
 * {@link DIST} 이상 갈 것. 붙이는 쪽에 `touch-pan-y` 를 같이 줘서 세로 스크롤은 브라우저가
 * 그대로 가져가게 한다.
 *
 * @param onSwipe `1` 이면 다음 장, `-1` 이면 이전 장. 손가락이 **왼쪽으로** 가면 다음이다
 */
export function useSwipePager(onSwipe: (direction: number) => void) {
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
      // 한 번 민 것으로 한 장만 넘긴다 — 지우지 않으면 손가락이 가는 내내 계속 넘어간다
      start.current = null;
      onSwipe(dx < 0 ? 1 : -1);
    },
    [onSwipe],
  );

  const onPointerEnd = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
