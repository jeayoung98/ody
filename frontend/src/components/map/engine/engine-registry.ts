import type { MapEngine } from "./map-engine";

/**
 * 지도 엔진 싱글턴 레지스트리.
 * 엔진은 MapCanvas 가 마운트할 때 만들어지고, 스토어 액션(drillDown 등)은 여기서 꺼내 위임한다.
 */
let engine: MapEngine | null = null;

export function registerMapEngine(e: MapEngine | null) {
  engine = e;
}

export function getMapEngine(): MapEngine | null {
  return engine;
}
