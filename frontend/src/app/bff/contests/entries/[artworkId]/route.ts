import { fail, okLive } from "@/lib/api-response";
import { backendGet, callerAuth } from "@/lib/backend";
import { artworkFail, parseId, toShape, type BackendArtworkDetail } from "@/lib/contest-bff";

type Ctx = { params: Promise<{ artworkId: string }> };

/**
 * 작품 한 점의 별자리 좌표 (S15P21A405-701) — `GET /api/artwork/detail?artworkId=`. 내 작품 목록(`mine`)은 좌표를
 * 빈 목록으로 주므로, 채점이 끝난 내 작품 카드가 그림을 그리려고 부른다. 점수가 없는 작품은 소유자에게만 보인다.
 */
export async function GET(req: Request, { params }: Ctx) {
  const artworkId = parseId((await params).artworkId);
  if (!artworkId) return fail("ARTWORK_NOT_FOUND", "없는 작품입니다.", 404);
  const upstream = `/api/artwork/detail?artworkId=${artworkId}`;
  try {
    const res = await backendGet<BackendArtworkDetail>(upstream, { headers: callerAuth(req) });
    return okLive(toShape(res), upstream);
  } catch (e) {
    return artworkFail(e, upstream);
  }
}
