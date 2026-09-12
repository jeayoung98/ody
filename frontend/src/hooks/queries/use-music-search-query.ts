import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MusicSearchPage } from "@/types";

/**
 * 곡 검색 (SEARCH-01). **한 페이지씩 받아 이어 붙인다** — 결과가 17만 건까지 나오므로
 * 첫 10곡만 보여주고 끝낼 수 없다. 백엔드가 `hasNext` 를 주므로 전체 건수는 필요 없다.
 *
 * 검색어를 바꾸면 쿼리 키가 바뀌어 **처음부터 다시 쌓인다** (`pages` 가 비워진다).
 */
export function useMusicSearchQuery(keyword: string) {
  const q = keyword.trim();
  return useInfiniteQuery({
    queryKey: QUERY_KEYS.music.search(q),
    queryFn: ({ pageParam }) => api<MusicSearchPage>(`${API_ENDPOINTS.music.search}?q=${encodeURIComponent(q)}&page=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    enabled: q.length > 0,
  });
}
