import type { MapViewMode } from "@/constants/panel";
import type { SheetSnap } from "@/stores/use-panel-store";

/**
 * **폰의 주변 탐색·별자리 뷰에서 별을 누르면 곡 상세를 몇 단으로 여나** (S15P21A405-715, 사용자 결정).
 * 순수 함수 — `tests/overlay-tap-snap.test.cjs` 가 묶는다.
 *
 * 기본 지도에서는 2 단으로 연다(S15P21A405-703). 두 뷰에서는 **지금 단을 바꾸지 않는다** — 2 단으로 올리면 고리·별자리
 * 아래쪽이 시트에 가려진다(뷰는 뜰 때 크기 그대로라 따라 줄지 않는다, `MapEngine.overlayRect`). 두 뷰는 1 단으로
 * 열리므로(S15P21A405-712) 누른 곡도 1 단에 서고, 곡 정보를 보려고 올려 둔 채 다음 별을 누르면 그 단 그대로다.
 * 열린 시트가 없으면 1 단이다. `undefined` 는 "여는 쪽 기본값(2 단)을 쓴다" 는 뜻이다.
 */
export function overlayTapSnap(o: { narrow: boolean; viewMode: MapViewMode; activePanel: string | null; snap: SheetSnap }): SheetSnap | undefined {
  if (!o.narrow || (o.viewMode !== "nearby" && o.viewMode !== "constellation")) return undefined;
  return o.activePanel ? o.snap : 1;
}
