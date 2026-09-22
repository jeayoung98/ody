"use client";

import { useEffect, type RefObject } from "react";

/**
 * **바깥을 누르면 닫는다. 그리고 그 누름은 아무 일도 일으키지 않는다** (S15P21A405-532).
 *
 * 폰에서 곡 상세 시트와 플레이리스트 추가 목록을 X 버튼으로만 닫을 수 있었다. 바깥을 눌러
 * 닫는 것이 앱의 기본 문법인데, 그냥 닫기만 하면 **그 누름이 아래로 새어** 지도의 별이
 * 선택되거나 탭이 이동해 버린다. 닫으려고 누른 것이 엉뚱한 동작이 되면 안 된다.
 *
 * ## 왜 덮개(scrim) 가 아니라 이 방식인가
 *
 * 화면을 덮는 투명 막을 깔면 z 값을 다시 짜야 한다 — 시트(z-20)·탭바(z-23)·재생바(z-21)
 * 사이에 막을 끼워 넣어야 하고, 덮개를 쓰는 UI 가 둘이라 서로의 순서까지 얽힌다. 게다가
 * 유리 패널이 `backdrop-filter` 를 쓰기 때문에 그 안에 둔 `position: fixed` 는 화면이 아니라
 * **패널에 갇힌다** (S15P21A405-417 에서 프로필 버튼이 탭바에 갇힌 것과 같은 원인).
 *
 * 여기서는 z 를 건드리지 않는다. 문서에서 **캡처 단계**로 먼저 받아 삼키므로 어느 쌓임
 * 맥락에 있든 상관없다.
 *
 * ## 왜 pointerdown 과 click 을 둘 다 듣는가
 *
 * `pointerdown` 만 막으면 지도(그쪽은 `onPointerDown` 으로 받는다)는 막히지만 **버튼은 안
 * 막힌다** — `click` 은 별개의 이벤트라 그대로 뒤따라 오고, 탭바가 그걸로 화면을 옮긴다.
 * 그래서 바깥 `pointerdown` 을 잡은 뒤 **뒤따르는 `click` 한 번**까지 같이 삼킨다.
 *
 * @param ref      이 요소 **안쪽**을 누른 것은 바깥으로 치지 않는다
 * @param onDismiss 바깥을 눌렀을 때 부른다
 * @param enabled  꺼 두면 아무것도 듣지 않는다 (데스크톱·닫혀 있을 때)
 */
export function useDismissOnOutside(ref: RefObject<HTMLElement | null>, onDismiss: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    /** 바깥 누름을 잡았다. 뒤따라 오는 click 한 번을 삼켜야 한다 */
    let swallowClick = false;

    const isOutside = (target: EventTarget | null) => {
      const el = ref.current;
      if (!el) return false;
      return !(target instanceof Node) || !el.contains(target);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isOutside(e.target)) return;
      swallowClick = true;
      e.stopPropagation();
      e.preventDefault();
      onDismiss();
    };

    /**
     * `preventDefault` 를 여기서도 부른다 — 링크처럼 기본 동작을 가진 요소가 바깥에 있으면
     * 전파를 막는 것만으로는 안 멈춘다.
     */
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [ref, onDismiss, enabled]);
}
