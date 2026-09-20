"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { BREAKPOINTS } from "@/constants/design-tokens";
import { useMapStore } from "@/stores/use-map-store";
import { usePanelStore } from "@/stores/use-panel-store";

/**
 * 시트가 완전히 사라지지 않고 **늘 남는 높이**(px). 손잡이와 제목 한 줄이 들어간다.
 * 여기까지 내려가도 손가락으로 다시 올릴 수 있어야 한다는 것이 이 값의 근거다.
 */
export const SHEET_PEEK = 120;

/**
 * 시트 아래에 서 있는 것들(재생바·네비)의 높이를 **읽어 온다.**
 *
 * 자리는 CSS 변수(`--sheet-bottom`)가 정하고, 여기서는 **얼마나 올릴 수 있는지**를 계산할 때만
 * 필요하다. 재생바 높이가 재생 상태에 따라 바뀌므로 상수로 두면 어느 쪽에서든 어긋난다 —
 * 값을 만드는 곳은 `main-screen.tsx` 한 곳이다.
 */
function bottomOffset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sheet-bottom");
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? px : 170;
}

/**
 * 시트가 올라갔을 때 **지도에 남겨 두는 최소 높이**(px). 화면 높이에서 이만큼을 빼고 남는
 * 것이 시트의 최대 높이다 — 화면을 통째로 덮지 않는다는 규칙(요청자 확정)을 이 값이 지킨다.
 *
 * 812px 폰에서 상단 HUD(72) 를 빼고도 별이 서너 겹 보이는 높이다.
 */
const MAP_MIN = 300;

/** 스냅 판정. 두 정거장 중 가까운 쪽으로 붙되, 세게 튕기면 그 방향으로 보낸다 */
const FLING = 0.5;

/**
 * 바텀시트 드래그 (S15P21A405-416).
 *
 * **좁은 화면에서만 동작한다.** 폭은 `pointerdown` 시점에 재므로 렌더 분기가 아니다 —
 * `BREAKPOINTS` 주석이 정한 조건이다. 데스크톱에서는 첫 줄에서 그냥 돌아간다.
 *
 * 높이는 `usePanelStore.sheetHeight` 에 쓴다. 지도 가림폭(`main-screen.tsx`)과 네비 숨김
 * (`layout/rail.tsx`)이 같은 값을 봐야 해서 컴포넌트 지역 상태로 두지 않았다.
 */
export function useBottomSheet() {
  const sheetHeight = usePanelStore((s) => s.sheetHeight);
  const setSheetHeight = usePanelStore((s) => s.setSheetHeight);
  const activePanel = usePanelStore((s) => s.activePanel);

  /** 드래그 한 번의 시작 상태. 프레임마다 바뀌는 값이라 state 로 두면 매번 다시 그린다 */
  const drag = useRef<{ y: number; h: number; t: number } | null>(null);

  const maxHeight = useCallback(() => Math.max(SHEET_PEEK, window.innerHeight - MAP_MIN - bottomOffset()), []);

  /**
   * 패널이 새로 열리면 늘 접힌 채로 시작한다 — 열자마자 지도를 덮어 버리지 않는다.
   *
   * **창 크기가 바뀔 때도 다시 판정한다.** 이걸 빼먹었더니 좁은 화면에서 시트를 띄운 뒤
   * 창을 넓혔을 때 `height: 120px` 인라인 스타일이 그대로 남아 **데스크톱 패널이 120px 로
   * 눌렸다.** 데스크톱은 시트가 아니므로 값 자체를 없애야 한다 — `null` 이면 인라인 스타일을
   * 아예 안 붙인다.
   */
  useEffect(() => {
    // `resize` 가 아니라 미디어 쿼리를 듣는다. 이건 크기가 아니라 **경계**를 넘는 사건이고,
    // 브라우저 기기 에뮬레이션에서는 `resize` 가 안 오는 경우가 있다 (실측).
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`);
    const sync = () => setSheetHeight(activePanel && mq.matches ? SHEET_PEEK : null);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [activePanel, setSheetHeight]);

  /**
   * **지도가 곧 결과일 때는 시트를 내린다** (S15P21A405-416).
   *
   * 주변 탐색과 경로(별자리)는 결과가 지도 위에 그려진다 — 패널은 같은 곡의 목록일 뿐이다.
   * 그 뷰를 켜는 순간 시트가 반쯤 올라와 있으면 정작 봐야 할 것을 시트가 덮는다.
   * 목록이 필요하면 손잡이를 올리면 된다.
   */
  const viewMode = useMapStore((s) => s.viewMode);
  useEffect(() => {
    if (viewMode === "default") return;
    if (window.innerWidth >= BREAKPOINTS.tablet) return;
    setSheetHeight(SHEET_PEEK);
  }, [viewMode, setSheetHeight]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (window.innerWidth >= BREAKPOINTS.tablet) return;
    drag.current = { y: e.clientY, h: sheetHeight ?? SHEET_PEEK, t: performance.now() };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 이미 놓친 포인터. 잡지 못해도 move 는 계속 온다 */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // 위로 끌면 커진다 — 화면 좌표는 아래로 갈수록 커지므로 부호를 뒤집는다
    const next = Math.min(maxHeight(), Math.max(SHEET_PEEK, d.h + (d.y - e.clientY)));
    setSheetHeight(next);
  };

  const end = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const moved = d.y - e.clientY;
    const speed = moved / Math.max(1, performance.now() - d.t);
    const top = maxHeight();
    const now = sheetHeight ?? SHEET_PEEK;
    // 세게 튕겼으면 그 방향, 아니면 가까운 정거장
    const goTop = Math.abs(speed) > FLING ? speed > 0 : now - SHEET_PEEK > top - now;
    setSheetHeight(goTop ? top : SHEET_PEEK);
  };

  /** 손잡이를 눌렀다 떼기만 해도 반대편으로 간다 — 끌 줄 모르는 사람을 위한 길 */
  const toggle = () => {
    if (window.innerWidth >= BREAKPOINTS.tablet) return;
    const top = maxHeight();
    setSheetHeight((sheetHeight ?? SHEET_PEEK) > SHEET_PEEK ? SHEET_PEEK : top);
  };

  return {
    sheetHeight,
    /** 손잡이 줄에 그대로 펼쳐 넣는다 */
    handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end },
    toggle,
  };
}
