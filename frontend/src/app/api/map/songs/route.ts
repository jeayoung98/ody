import { ok } from "@/lib/api-response";
import { allSongs } from "@/mocks/songs";

/**
 * 지도 곡 전체 (PC 16개 포함).
 * 실서비스: 레이어 0은 뷰포트 스트리밍, 게이트 이하로 좁히면 상주 집합만 통째로 내려받는다.
 */
export function GET() {
  return ok(allSongs());
}
