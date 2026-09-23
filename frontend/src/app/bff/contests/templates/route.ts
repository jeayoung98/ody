import { okLive } from "@/lib/api-response";
import { backendGet, callerAuth } from "@/lib/backend";
import { artworkFail } from "@/lib/contest-bff";
import type { ContestTemplate } from "@/types";

const UPSTREAM = "/api/artwork/templates";

/** AI 추천 모양 목록 (S15P21A405-595) — `GET /api/artwork/templates` → `[{ name, label, pointCount }]`. 로그인 필수 */
export async function GET(req: Request) {
  try {
    return okLive(await backendGet<ContestTemplate[]>(UPSTREAM, { headers: callerAuth(req) }), UPSTREAM);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
