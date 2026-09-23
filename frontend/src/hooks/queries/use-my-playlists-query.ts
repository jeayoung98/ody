import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { PlaylistSummary } from "@/types";

/**
 * 만든 플레이리스트. **이메일을 주면 그 사람 것**이다 (S15P21A405-587) — 남의 피드에도 같은
 * 목록이 뜬다 (USER-04 "마이페이지와 레이아웃 동일"). 안 주면 예전처럼 내 것이다.
 *
 * 이름을 `useMyPlaylistsQuery` 로 두는 이유는 부르는 세 곳 중 둘(플리 추가 메뉴 · 플리 패널)이
 * 실제로 **내 것**만 원하기 때문이다. 그쪽은 인자 없이 부르면 되고 손댈 것이 없다.
 */
export function useMyPlaylistsQuery(email?: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.playlist.mine(email ?? null),
    queryFn: () => api<PlaylistSummary[]>(API_ENDPOINTS.playlist.mine(email)),
  });
}
