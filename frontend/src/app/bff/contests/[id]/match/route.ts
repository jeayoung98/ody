import { CONTEST_DEFAULT_RULES } from "@/constants";
import { fail, ok } from "@/lib/api-response";
import { contestFail, parseId } from "@/lib/contest-bff";
import { contestIdMatches, matchSketch } from "@/mocks/contest";
import type { SketchPoint } from "@/types";

/**
 * ⚠ **목이다** — 그린 점 → 닮은 배치의 곡 (S15P21A405-598 의 자리). body `{ points: [{x,y}] }`.
 * 점은 0~1 정규화 캔버스 좌표. 개수는 회차 규칙(3~20) 안이어야 한다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contestId = parseId(id);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);

  const body = (await req.json().catch(() => ({}))) as { points?: unknown };
  const points = Array.isArray(body.points) ? (body.points as SketchPoint[]) : [];
  const valid = points.every((p) => typeof p?.x === "number" && typeof p?.y === "number" && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  const { minPoints, maxPoints } = CONTEST_DEFAULT_RULES;
  if (!valid || points.length < minPoints || points.length > maxPoints) {
    return fail("VALIDATION_ERROR", `점은 ${minPoints}~${maxPoints}개, 좌표는 0~1 이어야 합니다.`, 400);
  }
  try {
    return ok(await matchSketch(points));
  } catch (e) {
    return contestFail(e);
  }
}
