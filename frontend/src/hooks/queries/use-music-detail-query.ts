import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_ENDPOINTS, QUERY_KEYS } from "@/constants";
import type { MusicDetail } from "@/types";

/**
 * 곡 하나의 상세 (SONG-02).
 *
 * **세션 동안 다시 받지 않는다** (S15P21A405-514). 기본 `staleTime`(60초)으로 두었더니 같은 곡
 * 하나를 dev 로그 한 세션에서 **26번** 받고 있었다 — 패널을 여닫거나 1분만 지나면 다시 받는다.
 * 여기 담긴 것은 제목·아티스트·주성분 16개·가까운 10곡처럼 **세션 중에 바뀔 일이 없는 값**이라
 * 다시 물어볼 이유가 없다.
 *
 * `relatedPlaylists` 만 예외적으로 바뀔 수 있다(누가 이 곡을 플리에 담으면). 그건 새로고침하면
 * 반영된다 — 그 한 칸 때문에 곡 전체를 매분 다시 받는 쪽이 더 비싸다.
 *
 * 메모리는 기본 `gcTime`(5분)이 정리한다. 안 보는 곡은 5분 뒤 버려지고, 그 안에 다시 열면 공짜다.
 */
export function useMusicDetailQuery(musicId: number | null) {
  return useQuery({
    ...musicDetailQueryOptions(musicId ?? -1),
    enabled: musicId != null,
  });
}

/**
 * 훅 밖에서도 같은 조회를 쓸 수 있게 빼 둔다 (S15P21A405-581).
 *
 * 검색 결과를 고르면 지도가 그 곡의 좌표를 알아야 하는데, 좌표는 이 응답에 들어 있다.
 * **키와 `staleTime` 을 여기 한 벌만 둔다** — 두 벌이 되면 키가 어긋나는 순간 같은 곡을 두 번
 * 받고, `staleTime: Infinity` 로 아낀 것(S15P21A405-514)이 조용히 새어 나간다.
 */
export function musicDetailQueryOptions(musicId: number) {
  return {
    queryKey: QUERY_KEYS.music.detail(musicId),
    queryFn: () => api<MusicDetail>(API_ENDPOINTS.music.detail(musicId)),
    staleTime: Infinity,
  };
}
