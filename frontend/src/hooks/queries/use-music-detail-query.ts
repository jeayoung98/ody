import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MusicDetail } from "@/types";

export function useMusicDetailQuery(musicId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.music.detail(musicId ?? -1),
    queryFn: () => api<MusicDetail>(API_ENDPOINTS.music.detail(musicId!)),
    enabled: musicId != null,
  });
}
