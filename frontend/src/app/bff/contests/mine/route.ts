import { okLive } from "@/lib/api-response";
import { backendGet, callerAuth } from "@/lib/backend";
import { artworkFail, toEntry, type BackendArtworkSummary } from "@/lib/contest-bff";

const UPSTREAM = "/api/artwork/mine";

/**
 * 내 작품 (S15P21A405-640) — `GET /api/artwork/mine`. **모든 상태**가 온다(`PENDING`·`FAILED` 포함). 출품 뒤 채점을 기다리는
 * 화면이 이걸 폴링한다 — 소켓 알림이 없다 (§6-2). `points` 는 빈 목록이라 썸네일은 못 그린다. 로그인 필수.
 */
export async function GET(req: Request) {
  try {
    const res = await backendGet<BackendArtworkSummary[]>(UPSTREAM, { headers: callerAuth(req) });
    return okLive(res.map(toEntry), UPSTREAM);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
