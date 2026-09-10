import type { Id } from "./common";

/**
 * 별자리 배치 (PATH-01) — 백엔드가 16차원 좌표를 2D로 압축해 만든 **고정 모양**.
 * 레이어와 무관하게 같은 곡 집합이면 항상 같은 좌표가 와야 한다 (BACKEND-NOTES A-9).
 */
export interface ConstellationPoint {
  musicId: Id;
  /** -1 ~ 1 정규화 좌표. y 는 위가 양수 */
  x: number;
  y: number;
}

export interface ConstellationLayout {
  points: ConstellationPoint[];
}
