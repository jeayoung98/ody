import type { MapEngine } from "./map-engine";

/**
 * 지도 엔진 싱글턴 레지스트리.
 * 엔진은 MapCanvas 가 마운트할 때 만들어지고, 스토어 액션(drillDown 등)은 여기서 꺼내 위임한다.
 */
let engine: MapEngine | null = null;

export function registerMapEngine(e: MapEngine | null) {
  engine = e;
  /**
   * 개발 빌드에서만 창에 매단다 (S15P21A405-670 디버그). 콘솔에서 `__ODY_ENGINE__.debugHome()` 으로
   * 지금 겹·보는 경로·재생 경로·갈래 판정을 바로 읽는다. 배포 번들에는 안 들어간다.
   */
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __ODY_ENGINE__: MapEngine | null }).__ODY_ENGINE__ = e;
  }
}

export function getMapEngine(): MapEngine | null {
  return engine;
}
