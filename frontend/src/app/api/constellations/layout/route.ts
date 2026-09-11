import { fail, ok } from "@/lib/api-response";
import { mockConstellationLayout } from "@/mocks/constellation";

/** 별자리 배치 (PATH-01). body: { musicIds } → 16차원을 2D로 압축한 고정 좌표 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { musicIds?: number[] };
  if (!body.musicIds?.length) return fail("VALIDATION_ERROR", "musicIds 가 필요합니다.", 400);
  return ok(mockConstellationLayout(body.musicIds));
}
