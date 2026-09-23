/**
 * 지도 상주 집합 캐시의 상한 (S15P21A405-586).
 *
 * `useMapSongsQuery` 는 `staleTime`·`gcTime` 이 둘 다 `Infinity` 다. 그럴 만한 이유가 있다 —
 * 같은 범위의 상주 집합은 세션 중에 바뀌지 않고, 떠오를 때 재요청 없이 캐시에서 돌아와야
 * 겹 전환 연출이 끊기지 않는다 (`map-view` 는 집합이 없으면 별밭 자리표시자를 덮는다).
 *
 * 문제는 **버리는 길이 아예 없다는 것**이었다. 캐시 키가 누적 범위라 새 경로로 좁혀 들어갈
 * 때마다 키가 하나 늘고, 그 무엇도 사라지지 않는다. 한 항목이 1000점이면 JSON 만 296KB 다
 * (목 데이터 실측) — 오래 탐색하면 계속 쌓인다.
 *
 * 그래서 **개수 상한 + 쓴 순서(LRU)** 를 얹는다. 보는 컴포넌트가 있는 쿼리는 후보에서 빼므로
 * 지금 그리는 겹과 미리 받아 둔 다음 겹은 절대 지워지지 않는다.
 */

/** 들고 있을 상주 집합 수. 한 번 파고드는 길이 8겹이라 왕복 한 벌에 여유를 더한 값이다 */
export const MAX_CACHED_LAYER_SETS = 16;

export interface CachedLayerSet {
  /** 캐시 키의 범위 부분 */
  key: string;
  /** 지금 이 집합을 보는 컴포넌트가 있는가. 있으면 지우지 않는다 */
  active: boolean;
  /** 마지막으로 쓴 때. 클수록 최근 */
  usedAt: number;
}

/**
 * 내보낼 키를 고른다. **오래 안 쓴 것부터**, 상한에 닿을 때까지.
 *
 * 보는 컴포넌트가 있는 것은 고르지 않는다 — 지우면 그 자리가 빈손이 되고, 지도는 집합이
 * 없는 동안 자리표시자를 덮는다. 지울 게 없으면 상한을 넘은 채로 둔다. 상한은 약속이지
 * 지금 쓰는 것을 빼앗을 이유가 아니다.
 */
export function layerSetsToEvict(entries: readonly CachedLayerSet[], cap: number = MAX_CACHED_LAYER_SETS): string[] {
  const over = entries.length - cap;
  if (over <= 0) return [];
  const evictable = entries.filter((e) => !e.active).sort((a, b) => a.usedAt - b.usedAt);
  return evictable.slice(0, Math.min(over, evictable.length)).map((e) => e.key);
}

/** 쓴 순서. 키마다 번호를 하나 매긴다 — 시계가 아니라 순서만 필요하다 */
const usedAt = new Map<string, number>();
let tick = 0;

export function touchLayerSet(key: string): void {
  usedAt.set(key, ++tick);
}

export function layerSetUsedAt(key: string): number {
  return usedAt.get(key) ?? 0;
}

/** 캐시에 없는 키의 순서 기록은 같이 버린다 — 안 그러면 이 표만 끝없이 자란다 */
export function forgetLayerSetsExcept(present: ReadonlySet<string>): void {
  for (const key of usedAt.keys()) if (!present.has(key)) usedAt.delete(key);
}

/** 테스트용 */
export function resetLayerSetOrder(): void {
  usedAt.clear();
  tick = 0;
}
