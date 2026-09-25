import { fail, okLive } from "@/lib/api-response";
import { backendPost, callerAuth } from "@/lib/backend";
import { artworkFail, parseId } from "@/lib/contest-bff";

type Ctx = { params: Promise<{ artworkId: string }> };

/**
 * 실패한 내 작품 재평가 (S15P21A405-640) — `POST /api/artwork/retry/{id}`. 3회까지(`ARTWORK_RETRY_EXHAUSTED`).
 * 돌려줄 값이 없어 `data: null` 이 정상이다.
 */
export async function POST(req: Request, { params }: Ctx) {
  const artworkId = parseId((await params).artworkId);
  if (!artworkId) return fail("ARTWORK_NOT_FOUND", "없는 작품입니다.", 404);
  const upstream = `/api/artwork/retry/${artworkId}`;
  try {
    await backendPost<unknown>(upstream, {}, { headers: callerAuth(req) }, { allowNullData: true });
    return okLive({ artworkId }, upstream);
  } catch (e) {
    return artworkFail(e, upstream);
  }
}
