import { CONTEST_SKY } from "@/constants";
import type { ContestEntry, ContestTrack } from "@/types";

/**
 * 이벤트 탑 작품을 최상단 겹의 **실제 곡 자리**에 놓는다 (S15P21A405-684).
 *
 * 작품의 `tracks[].x·y` 는 곡들의 pc1·pc2 에서 **집합 평균을 빼고 한 배율로 나눈 값**이다
 * (백엔드 `PlanarProjection`: `x = (pc1 − 평균) / span`). 그래서 좌표를 아는 곡이 둘만 있으면 평균과 배율을
 * 되살려 나머지 곡도 전부 제자리에 놓을 수 있다 — 곡마다 상세를 조회할 필요가 없다.
 */

/** 지도에 그릴 작품 하나. `pts` 는 최상단 겹의 월드 좌표(pc1, pc2) */
export interface SkyShape {
  artworkId: number;
  rank: number;
  title: string;
  playlistId: number | null;
  closed: boolean;
  pts: { musicId: number; x: number; y: number }[];
}

/** 배치 좌표 → 월드 좌표: `world = offset + scale × layout` */
export interface LayoutFit {
  scale: number;
  ox: number;
  oy: number;
}

/** 순위 있는 작품을 순위순으로 `n` 개. 모양을 이을 수 없는(점 2개 미만) 작품은 뺀다 */
export function topEntries(items: readonly ContestEntry[], n: number = CONTEST_SKY.top): ContestEntry[] {
  return items
    .filter((e): e is ContestEntry & { rank: number } => e.rank != null && e.tracks.length >= 2)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

/**
 * 좌표를 알아야 하는 곡 둘 — 배치에서 **가장 멀리 떨어진 쌍**이다. 가까운 둘로 배율을 재면 반올림 오차가 커진다.
 * 점이 하나뿐이거나 전부 한 자리면 null.
 */
export function anchorPair(tracks: readonly ContestTrack[]): [ContestTrack, ContestTrack] | null {
  let best: [ContestTrack, ContestTrack] | null = null;
  let bestD = 0;
  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const d = (tracks[i].x - tracks[j].x) ** 2 + (tracks[i].y - tracks[j].y) ** 2;
      if (d > bestD) {
        bestD = d;
        best = [tracks[i], tracks[j]];
      }
    }
  }
  return best;
}

/**
 * 좌표를 아는 곡들로 평균·배율을 되살린다 — 회전 없는 닮음 변환의 최소제곱.
 * 아는 곡이 둘 미만이거나 배치가 한 점이면 null.
 */
export function fitLayout(tracks: readonly ContestTrack[], known: ReadonlyMap<number, { x: number; y: number }>): LayoutFit | null {
  const pairs = tracks.flatMap((t) => {
    const w = known.get(t.musicId);
    return w ? [{ lx: t.x, ly: t.y, wx: w.x, wy: w.y }] : [];
  });
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const mlx = pairs.reduce((s, p) => s + p.lx, 0) / n;
  const mly = pairs.reduce((s, p) => s + p.ly, 0) / n;
  const mwx = pairs.reduce((s, p) => s + p.wx, 0) / n;
  const mwy = pairs.reduce((s, p) => s + p.wy, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pairs) {
    num += (p.wx - mwx) * (p.lx - mlx) + (p.wy - mwy) * (p.ly - mly);
    den += (p.lx - mlx) ** 2 + (p.ly - mly) ** 2;
  }
  if (den < 1e-12) return null;
  const scale = num / den;
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  return { scale, ox: mwx - scale * mlx, oy: mwy - scale * mly };
}

/** 작품 하나를 월드 좌표로. 맞출 수 없으면 null */
export function toSkyShape(entry: ContestEntry, known: ReadonlyMap<number, { x: number; y: number }>): SkyShape | null {
  if (entry.rank == null) return null;
  const fit = fitLayout(entry.tracks, known);
  if (!fit) return null;
  return {
    artworkId: entry.artworkId,
    rank: entry.rank,
    title: entry.title,
    playlistId: entry.playlistId,
    closed: entry.closed,
    pts: entry.tracks.map((t) => ({ musicId: t.musicId, x: fit.ox + fit.scale * t.x, y: fit.oy + fit.scale * t.y })),
  };
}

/** 점 (px,py) 에서 선분 ab 까지의 거리 제곱 */
export function distSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** 탑 작품 중 이 플리의 순위. 아니면 null — 플레이어바 태그가 쓴다 */
export function contestRankOf(items: readonly ContestEntry[] | undefined, playlistId: number | null): number | null {
  if (!items || playlistId == null) return null;
  return topEntries(items).find((e) => e.playlistId === playlistId)?.rank ?? null;
}
