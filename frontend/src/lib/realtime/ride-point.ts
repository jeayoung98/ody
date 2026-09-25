import type { QueryClient } from "@tanstack/react-query";
import { getMapEngine } from "@/components/map/engine/engine-registry";
import { musicDetailQueryOptions } from "@/hooks/queries/use-music-detail-query";
import { musicToMapPoint } from "@/lib/map-point";

/**
 * 인솔자 곡의 좌표를 지도 엔진이 갖게 한다 (S15P21A405-674).
 *
 * 겹 상주 집합은 서버가 고른 top-k 라, 인솔자가 검색·플리에서 튼 곡은 지도에 없는 경우가 흔하다. 그러면
 * `startFollow`·`rideTo`·`rideToLayer` 가 전부 `index.has` 에서 빠져나가 **우주선이 안 뜨거나 제자리에 멈춘다.**
 * 곡 상세의 `location` 이 16개 좌표를 그대로 주므로 그걸 편입(`adopt`)한다. 상세는 캐시(`staleTime: Infinity`)에
 * 있으면 즉시다 — 주변 사람 카드가 이미 제목을 받아 뒀으면 한 번의 조회도 없다.
 *
 * 편입은 좌표만 갖게 할 뿐 상주 집합에는 넣지 않는다 (`adopt`). 좌표가 없는 곡이거나 조회가 실패하면 false —
 * 부르는 쪽은 예전 길로 그냥 간다.
 */
export async function ensureSongPoint(qc: QueryClient, musicId: number): Promise<boolean> {
  if (getMapEngine()?.pointOf(musicId)) return true;
  try {
    const point = musicToMapPoint(await qc.fetchQuery(musicDetailQueryOptions(musicId)));
    if (!point) return false;
    const engine = getMapEngine();
    if (!engine) return false;
    engine.adopt([point]);
    return true;
  } catch {
    return false;
  }
}
