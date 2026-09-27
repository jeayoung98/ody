import { CONTEST_TOP } from "@/constants";
import type { ContestEntry } from "@/types";

/** 순위 있는 작품을 순위순으로 `n` 개 (S15P21A405-684) */
export function topEntries(items: readonly ContestEntry[], n: number = CONTEST_TOP): ContestEntry[] {
  return items
    .filter((e): e is ContestEntry & { rank: number } => e.rank != null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

/** 탑 작품 중 이 플리의 순위. 아니면 null — 플레이어바 태그가 쓴다 */
export function contestRankOf(items: readonly ContestEntry[] | undefined, playlistId: number | null): number | null {
  if (!items || playlistId == null) return null;
  return topEntries(items).find((e) => e.playlistId === playlistId)?.rank ?? null;
}
