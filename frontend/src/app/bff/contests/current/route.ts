import { okLive } from "@/lib/api-response";
import { backendGet, callerAuth } from "@/lib/backend";
import { artworkFail, toRound, type BackendArtworkRound } from "@/lib/contest-bff";

const UPSTREAM = "/api/artwork/round/current";

/**
 * 지금 열린 회차 (S15P21A405-640) — `GET /api/artwork/round/current`. **없으면 `null` 이다, 오류가 아니다.**
 * 호출자 토큰을 넘겨야 `myVotesLeft` 가 채워진다(비로그인은 `null`).
 */
export async function GET(req: Request) {
  try {
    const round = await backendGet<BackendArtworkRound | null>(UPSTREAM, { headers: callerAuth(req) }, { allowNullData: true });
    return okLive(round ? toRound(round) : null, UPSTREAM);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
