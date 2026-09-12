import { fail, ok } from "@/lib/api-response";
import { mockConstellationLayout } from "@/mocks/constellation";

/**
 * 별자리 배치 (PATH-01). body: `{ musicIds, points? }` → 16차원을 2D로 압축한 고정 좌표.
 *
 * `points` 는 프론트가 아는 16차원 좌표다. 아직 백엔드 구현 전이라 여기서 목으로 계산하는데,
 * 목은 `mocks/songs.ts` 밖의 곡(배포 백엔드에서 온 여정 경로 곡)을 모른다 — 그러면 좌표가 전부 0 이
 * 되어 배치가 한 점으로 눌린다. 그래서 아는 좌표를 받아 쓴다 (BACKEND-NOTES A-9).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { musicIds?: number[]; points?: { musicId: number; pc: number[] }[] };
  if (!body.musicIds?.length) return fail("VALIDATION_ERROR", "musicIds 가 필요합니다.", 400);
  return ok(mockConstellationLayout(body.musicIds, body.points));
}
