import { fail, ok } from "@/lib/api-response";
import { mockJourney } from "@/mocks/music";

/** GET /api/journeys/route?start=<musicId>&end=<musicId> */
export function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const start = Number(sp.get("start"));
  const end = Number(sp.get("end"));
  if (!start || !end) return fail("VALIDATION_ERROR", "start' end' 파라미터가 필요합니다.", 400);
  return ok(mockJourney(start, end));
}
