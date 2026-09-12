import { ok } from "@/lib/api-response";
import { allSongs } from "@/mocks/songs";

/**
 * 지도 곡 전체 (PC 16개 포함).
 * 실서비스: 겹마다 그 겹의 상주 집합(LAYER_SONG_COUNT 규모)을 내려받는다.
 */
export function GET() {
  return ok(allSongs());
}
