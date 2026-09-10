import type { ConstellationLayout } from "@/types";
import { songById } from "./songs";

/**
 * 별자리 배치 목 (PATH-01) — 실서비스에서는 백엔드가 계산한다 (BACKEND-NOTES A-9).
 *
 * 16차원 좌표를 2D로 눌러 만든 고정 모양. 여기서는 곡 집합의 공분산 상위 두 축에
 * 투영하는 방식(간이 PCA)을 쓴다. **레이어와 무관하고, 같은 곡 집합이면 항상 같은 모양**이다.
 */
export function mockConstellationLayout(musicIds: number[]): ConstellationLayout {
  const rows = musicIds.map((id) => songById(id)?.pc ?? new Array(16).fill(0)).map((pc) => [...pc]);
  const n = rows.length;
  if (n === 0) return { points: [] };

  // 중심 이동
  const mean = new Array(16).fill(0);
  for (const r of rows) for (let d = 0; d < 16; d++) mean[d] += r[d] / n;
  for (const r of rows) for (let d = 0; d < 16; d++) r[d] -= mean[d];

  // 거듭제곱 반복으로 1축을 찾고, 그 성분을 뺀 뒤 2축을 찾는다 (결정적 시작 벡터)
  const axis1 = power(rows, seed(0));
  const rest = rows.map((r) => {
    const p = dot(r, axis1);
    return r.map((v, d) => v - p * axis1[d]);
  });
  const axis2 = power(rest, seed(1));

  const raw = rows.map((r) => ({ x: dot(r, axis1), y: dot(r, axis2) }));
  const span = Math.max(1e-6, ...raw.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));

  return {
    points: musicIds.map((musicId, i) => ({ musicId, x: raw[i].x / span, y: raw[i].y / span })),
  };
}

/** 결정적 시작 벡터 — 매번 같은 모양이 나와야 한다 */
function seed(k: number): number[] {
  return Array.from({ length: 16 }, (_, d) => Math.sin(d * 12.9898 + k * 78.233) * 43758.5453 % 1);
}

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let d = 0; d < a.length; d++) s += a[d] * b[d];
  return s;
}

function normalize(v: number[]) {
  const len = Math.hypot(...v) || 1;
  return v.map((x) => x / len);
}

/** 공분산 행렬의 주축을 거듭제곱 반복으로 근사 */
function power(rows: number[][], start: number[]) {
  let v = normalize(start);
  for (let iter = 0; iter < 40; iter++) {
    const next = new Array(16).fill(0);
    for (const r of rows) {
      const p = dot(r, v);
      for (let d = 0; d < 16; d++) next[d] += p * r[d];
    }
    v = normalize(next);
  }
  return v;
}
