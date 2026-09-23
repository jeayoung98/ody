import { getMapEngine } from "@/components/map/engine/engine-registry";
import type { Point } from "@/lib/nearby-from-layer";

/**
 * 곡 하나가 그 층에서 서 있는 자리 (S15P21A405-582).
 *
 * 층마다 표시축 두 개가 달라서(`layer * 2`, `+1`) 같은 곡도 층이 바뀌면 다른 자리다. 주변 사람
 * 목록과 레이더가 **같은 눈금**을 써야 해서 한 군데 두고 둘이 같이 부른다.
 *
 * 지도가 모르는 곡이면 `null` 이다. 그 층 상주 집합 밖의 곡이 그렇고, 그때 자리를 아는 쪽은
 * 서버뿐이라 응답에 실려 온 좌표를 쓴다.
 */
export function layerPointOf(musicId: number | null, layer: number): Point | null {
  const song = musicId != null ? getMapEngine()?.pointOf(musicId) : null;
  return song ? { x: song.pc[layer * 2], y: song.pc[layer * 2 + 1] } : null;
}
