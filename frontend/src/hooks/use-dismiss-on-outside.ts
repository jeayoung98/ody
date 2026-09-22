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
 * ## 삼키는 쪽은 이 훅의 수명 밖에 둔다
 *
 * 처음에는 `click` 도 아래 `useEffect` 안에서 들었는데 **안 먹었다.** `pointerdown` 에서
 * 닫으면 React 가 곧바로 다시 그리고, `enabled` 가 false 가 되면서 **정리 함수가 먼저 돌아
 * 리스너를 떼어 버린다.** 그 뒤에 오는 `click` 은 삼킬 사람이 없다 — 시트는 닫히는데 탭은
 * 그대로 눌려 화면이 넘어갔다 (실측: 시트 닫힘 + 주소가 `/chart` 로 바뀜).
 *
 * 그래서 삼키는 리스너는 `pointerdown` 을 잡은 그 자리에서 **직접 걸고 스스로 뗀다.**
 * 이 훅이 그 사이에 사라져도 살아남는다. `click` 이 끝내 안 오는 경우(스크롤로 취소 등)를
 * 대비해 시한도 같이 건다 — 안 그러면 다음에 엉뚱한 누름 하나를 먹는다.
 *
 * ## 어디를 눌렀을 때까지 "바깥" 인가
 *
 * 처음에는 **시트 밖 전부**를 바깥으로 쳤다. 그랬더니 탭바와 재생바 버튼까지 같이 삼켜서
 * **하단 UI 가 통째로 안 눌렸다** — 곡 상세를 열어 둔 채로는 탭 이동도, 재생바의 플리 추가도
 * 첫 누름이 늘 "시트 내리기" 로 먹혔다. 시트는 거의 항상 열려 있으므로 사실상 상시였다.
 *
 * 그래서 {@link only} 로 **셀 자리를 정한다.** 곡 상세는 지도만 센다 — 지도를 보려고 누른
 * 것이 시트를 내리는 뜻이고, HUD 버튼을 누른 것은 그 버튼을 쓰겠다는 뜻이다.
 *
 * @param ref      이 요소 **안쪽**을 누른 것은 바깥으로 치지 않는다
 * @param onDismiss 바깥을 눌렀을 때 부른다
 * @param enabled  꺼 두면 아무것도 듣지 않는다 (데스크톱·닫혀 있을 때)
 * @param counts   주면 **이 판정이 참인 누름만** 센다. 없으면 바깥 전부
 */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled: boolean,
  counts?: (e: PointerEvent) => boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    const isOutside = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return false;
      if (e.target instanceof Node && el.contains(e.target)) return false;
      // 판정을 정해 뒀으면 그것이 참일 때만 바깥으로 친다
      return counts ? counts(e) : true;
    };

    /**
     * 뒤따라 오는 `click` 한 번을 삼킨다. **이 훅이 사라진 뒤에 와도 삼켜야** 하므로
     * `useEffect` 정리와 엮지 않고 스스로 뗀다 (위 주석 참고).
     *
     * `preventDefault` 도 부른다 — 링크처럼 기본 동작을 가진 요소가 바깥에 있으면 전파를
     * 막는 것만으로는 안 멈춘다.
     */
    const swallowNextClick = () => {
      let timer = 0;
      const off = () => {
        document.removeEventListener("click", swallow, true);
        window.clearTimeout(timer);
      };
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        off();
      };
      document.addEventListener("click", swallow, true);
      // click 이 끝내 안 오는 경우(끌다가 취소 등)를 대비한 시한. 없으면 다음 누름을 먹는다
      timer = window.setTimeout(off, 700);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isOutside(e)) return;
      e.stopPropagation();
      e.preventDefault();
      swallowNextClick();
      onDismiss();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [ref, onDismiss, enabled, counts]);
}
