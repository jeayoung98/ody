import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MusicSearchResult } from "@/types";

export function useMusicSearchQuery(keyword: string) {
  const q = keyword.trim();
  return useQuery({
    queryKey: QUERY_KEYS.music.search(q),
    queryFn: () => api<MusicSearchResult[]>(`${API_ENDPOINTS.music.search}?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });
}
