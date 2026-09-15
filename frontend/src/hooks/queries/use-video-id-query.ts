import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";

interface VideoIdResult {
  musicId: number;
  /** 사이트 안에서 틀 수 있는 영상. 없으면 null — 아직 음원이 연결되지 않은 곡이다 (SONG-04) */
  videoId: string | null;
}

/**
 * 곡 하나의 `videoId` (SONG-03, S15P21A405-340).
 *
 * **한 곡씩만 부른다.** 백엔드 조회는 DB 에 없으면 외부 API 를 호출해 채우는 동작이라 여러 곡을
 * 한꺼번에 치면 그만큼 비싸다. 곡 상세를 열거나 그 곡을 틀 때만 필요하므로 그때 한 번 받는다.
 *
 * 캐시가 곡별로 나뉘어 있어서, 같은 곡을 여러 화면(상세·플레이어바·임베드)이 동시에 물어도
 * 요청은 한 번만 나간다. `staleTime` 을 길게 잡는다 — 한 곡의 영상이 세션 중에 바뀔 일이 없다.
 */
export function useVideoIdQuery(musicId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.music.videoId(musicId ?? -1),
    queryFn: () => api<VideoIdResult>(API_ENDPOINTS.music.videoId(musicId!)),
    enabled: musicId != null,
    staleTime: 30 * 60 * 1000,
  });
}
