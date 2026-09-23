import { fail, ok } from "@/lib/api-response";
import { contestFail, parseId } from "@/lib/contest-bff";
import { contestIdMatches, judgeShape } from "@/mocks/contest";
import type { ContestTrack } from "@/types";

/**
 * ⚠ **목이다** — 배치를 보고 테마 닮음 점수·한 줄 평 (S15P21A405-548 의 자리).
 * body `{ tracks: ContestTrack[], closed }`. 같은 배치면 같은 답이라 미리보기 점수 = 출품 점수.
 * 실서비스는 곡·사용자 정보 없이 **모양 이미지만** 모델에 보내야 한다 (공정성).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contestId = parseId(id);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);

  const body = (await req.json().catch(() => ({}))) as { tracks?: unknown; closed?: unknown };
  const tracks = Array.isArray(body.tracks) ? (body.tracks as ContestTrack[]) : [];
  if (tracks.length < 3) return fail("VALIDATION_ERROR", "곡이 3개 이상이어야 심사할 수 있습니다.", 400);
  try {
    return ok(judgeShape(tracks, body.closed === true));
  } catch (e) {
    return contestFail(e);
  }
}
