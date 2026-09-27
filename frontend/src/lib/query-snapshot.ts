import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * 낙관적 업데이트의 **되돌리기** (S15P21A405-675).
 *
 * 누르는 순간 캐시를 먼저 바꾸는 뮤테이션은 실패했을 때 누르기 전으로 돌아가야 한다. 접두 키로 걸리는
 * 쿼리 전부(예: 내 플리 목록은 이메일별로 키가 여럿이다)를 그대로 저장해 두고, 돌려주는 함수를 부르면
 * 그 값으로 되돌린다. 그 사이 진행 중이던 재조회는 취소한다 — 안 그러면 옛 응답이 낙관적 값을 덮는다.
 */
export async function snapshotQueries(qc: QueryClient, keys: readonly QueryKey[]): Promise<() => void> {
  await Promise.all(keys.map((queryKey) => qc.cancelQueries({ queryKey })));
  const saved = keys.flatMap((queryKey) => qc.getQueriesData<unknown>({ queryKey }));
  return () => {
    for (const [key, data] of saved) qc.setQueryData(key, data);
  };
}
