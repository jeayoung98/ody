import { fail, okLive } from "@/lib/api-response";
import { backendPost, callerAuth } from "@/lib/backend";
import { artworkFail, parseId } from "@/lib/contest-bff";
import type { ContestLikeResult } from "@/types";

type Ctx = { params: Promise<{ artworkId: string }> };
const UPSTREAM = "/api/artwork/like";

/**
 * 좋아요 = 콘테스트 표 (S15P21A405-616 · 640) — `POST /api/artwork/like { artworkId, liked }`.
 * `liked` 는 토글이 아니라 **목표 상태**다. 회차당 남의 작품 `voteLimit`(3)개, 내 작품 금지 — 서버가 `ARTWORK_VOTE_LIMIT`·
 * `ARTWORK_VOTE_SELF` 로 거절하고 그대로 올린다. 플리 좋아요(PATH-07)와 별개 카운터다.
 */
export async function POST(req: Request, { params }: Ctx) {
  const artworkId = parseId((await params).artworkId);
  if (!artworkId) return fail("ARTWORK_NOT_FOUND", "없는 작품입니다.", 404);
  const body = (await req.json().catch(() => ({}))) as { liked?: unknown };
  if (typeof body.liked !== "boolean") return fail("VALIDATION_ERROR", "liked 가 필요합니다.", 400);
  try {
    return okLive(await backendPost<ContestLikeResult>(UPSTREAM, { artworkId, liked: body.liked }, { headers: callerAuth(req) }), UPSTREAM);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
