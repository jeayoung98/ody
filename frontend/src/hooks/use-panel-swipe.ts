"use client";

import { useCallback, useRef, type PointerEvent } from "react";
import { usePanelStore, type SheetSnap } from "@/stores/use-panel-store";

/** 한 단 옮기는 데 필요한 최소 거리(px). 이보다 짧으면 그냥 탭이거나 세로 스크롤의 흔들림이다 */
const DIST = 56;
/** 세로가 가로보다 이만큼 길어야 "위아래로 민 것" 으로 본다 */
const RATIO = 1.3;
/** 이 안에서 손을 떼면 **탭**으로 본다. 손가락은 가만히 있어도 몇 px 흔들린다 */
const TAP_SLOP = 10;

/**
 * 누르는 쪽이 제 할 일을 가진 것들. 여기를 눌렀을 때는 단을 올리지 않는다 —
 * ▶ 를 눌렀는데 재생과 함께 시트까지 올라오면 누른 사람이 무엇을 시킨 건지 모르게 된다.
 */
const INTERACTIVE = "button, a, input, textarea, select, label, [role='button'], [contenteditable='true']";

/**
 * 폰에서 **시트를 만져 단을 옮긴다** (S15P21A405-417, S15P21A405-416, S15P21A405-547).
 *
 * 폰의 곡 상세·여정·플리는 아래에서 올라오는 **바텀시트**이고 설 수 있는 자리가 셋이다
 * (`use-panel-store.ts` 의 `SheetSnap`). 올리면 더 많이 보이고 내리면 지도가 드러난다.
 * **닫는 게 아니다** — 별자리·주변 탐색은 그대로 살아 있고 시트만 미끄러진다.
 *
 * 두 가지를 받는다.
 * - **밀기**: 위로 한 단, 아래로 한 단. 한 번 밀면 한 단만 간다 — 1 에서 3 으로 건너뛰지
 *   않는다. 손가락이 가는 내내 계속 넘어가면 어디에 설지를 손이 못 고른다.
 * - **탭**: 시트 아무 데나 한 번 누르면 한 단 올라간다 (1→2→3). 손잡이를 정확히 겨누게
 *   하지 않는다 — 처음에 손잡이에만 붙였더니 "UI 를 눌러도 안 올라간다" 는 말이 나왔다.
 *   **3 단에서는 아무 일도 안 한다** — 거기서는 내용을 읽고 만지는 것이 할 일이다.
 *
 * 1 단에서 더 내려도 닫지 않는다: 닫는 길은 X 와 바깥 누름 둘이고, 끌다가 실수로 닫히면
 * 열어 둔 곡을 다시 찾아야 한다.
 *
 * **마우스는 빼 둔다.** 데스크톱에서 패널은 옆으로 접히고, 드래그는 글자 선택이며, 클릭으로
 * 패널이 커지면 그쪽 문법과 어긋난다.
 *
 * 목록의 세로 스크롤과 다투지 않게 두 가지를 본다: 세로가 가로보다 {@link RATIO} 배 길 것,
 * {@link DIST} 이상 갈 것. 그리고 **내용이 위로 더 굴러갈 수 있으면 넘긴다** — 목록 한가운데서
 * 아래로 당기는 것은 스크롤이지 시트를 내리라는 뜻이 아니다. `preventDefault` 는 하지 않는다.
 */
export function usePanelSwipe() {
  const snap = usePanelStore((s) => s.snap);
  const setSnap = usePanelStore((s) => s.setSnap);
  const raiseSnap = usePanelStore((s) => s.raiseSnap);
  const start = useRef<{ x: number; y: number } | null>(null);
  /** 이번 제스처가 이미 단을 옮겼나. 옮겼으면 손을 뗄 때 탭으로 또 세지 않는다 */
  const moved = useRef(false);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved.current = true;
      if (Math.abs(dy) < DIST || Math.abs(dy) < Math.abs(dx) * RATIO) return;
      // 위로 밀면 한 단 올리고, 아래로 밀면 한 단 내린다. 양 끝에서는 할 일이 없다
      const next = (dy < 0 ? snap + 1 : snap - 1) as SheetSnap;
      if (next < 1 || next > 3) {
        start.current = null;
        return;
      }
      // 펼친 상태에서 아래로 당길 때, 목록이 아직 위로 굴러 있으면 그건 스크롤이다
      if (dy > 0) {
        const scroller = (e.target as HTMLElement).closest<HTMLElement>(".scroll-quiet, [data-sheet-scroll]");
        if (scroller && scroller.scrollTop > 0) return;
      }
      start.current = null;
      setSnap(next);
    },
    [snap, setSnap],
  );

  /**
   * 손을 뗐다. 움직이지 않았고 누를 것을 누른 게 아니면 **탭**이다 — 한 단 올린다.
   *
   * `pointerup` 에서 본다. `click` 은 버튼 위에서 눌렀다 떼면 그 버튼이 먼저 먹고, 그마저도
   * 안 오는 자리가 있어서 "눌렀는데 아무 일도 안 난다" 가 생긴다.
   */
  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      start.current = null;
      if (!s || moved.current || snap === 3) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      raiseSnap();
    },
    [snap, raiseSnap],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
