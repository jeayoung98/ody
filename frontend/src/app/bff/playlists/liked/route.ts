import { ok } from "@/lib/api-response";

/**
 * 좋아요한 플레이리스트 — **배포 API 에 좋아요가 아예 없다** (BACKEND-NOTES A-36).
 *
 * 빈 목록으로 답한다. 예전처럼 목에서 몇 개 집어 주면 **좋아요한 적 없는 플리가 내 목록에 뜨고**,
 * 눌러도 지워지지 않아서 고장으로 보인다. 백엔드에 `playlist_like` 가 생기면 여기만 바꾸면 된다.
 */
export function GET() {
  return ok([]);
}
