import { useLayoutEffect } from "react";
import { useMapCoverStore } from "@/stores/use-map-cover-store";

/**
 * 이 화면이 지도를 통째로 덮는다고 알린다 (S15P21A405-737). 덮은 동안 지도는 그리기를 쉰다.
 *
 * **레이아웃 효과다.** 일반 효과는 화면을 칠한 뒤에 돌아서, 지도로 돌아오는 순간 한 프레임 동안
 * 덮이기 전에 멈춰 둔 그림이 보일 수 있다. 레이아웃 효과는 칠하기 전에 돌아 그 프레임부터 바로 그린다.
 *
 * @param active 실제로 덮고 있을 때만 참 — 화면이 `null` 을 그리는 경우(감춘 패널 등)에는 거짓
 */
export function useCoverMap(active = true) {
  useLayoutEffect(() => {
    if (!active) return;
    const { cover, uncover } = useMapCoverStore.getState();
    cover();
    return uncover;
  }, [active]);
}
