import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { JourneyRoute } from "@/types";

/**
 * 백엔드 `GET /api/music/journey` 응답 (정본 §3.3).
 * `path` 원소는 `step` + MusicDetail 필드가 평탄하게 펼쳐진 형태다.
 */
interface JourneyApiResponse {
  /** `path` 길이. 출발·도착을 포함한다 */
  musicCnt: number;
  totalDuration: number;
  path: JourneyApiStop[];
}

interface JourneyApiStop {
  /** 0부터 1씩 증가하는 연속값 */
  step: number;
  id: number;
  title: string;
  artist: string | null;
  duration: number | null;
  /** 장르명 문자열 배열. 프론트는 대표 하나만 쓴다 */
  genres: string[] | null;
}

/** 백엔드 응답 → 화면이 쓰는 JourneyRoute. 출발/도착 ID 는 요청값을 그대로 되돌려 채운다 */
function toJourneyRoute(res: JourneyApiResponse, startId: number, endId: number): JourneyRoute {
  return {
    startMusicId: startId,
    endMusicId: endId,
    totalDuration: res.totalDuration,
    stops: res.path.map((stop) => ({
      id: stop.id,
      title: stop.title,
      artist: stop.artist,
      duration: stop.duration,
      order: stop.step,
      genreName: stop.genres?.[0] ?? null,
    })),
  };
}

/** 출발/도착이 모두 지정되고 enabled일 때만 경로를 요청 */
export function useJourneyRouteQuery(startId: number | null, endId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.journey.route(startId ?? -1, endId ?? -1),
    queryFn: async () => {
      const res = await api<JourneyApiResponse>(`${API_ENDPOINTS.journey.route}?start=${startId}&end=${endId}`);
      return toJourneyRoute(res, startId!, endId!);
    },
    enabled: enabled && startId != null && endId != null,
    staleTime: 10 * 60 * 1000,
  });
}
