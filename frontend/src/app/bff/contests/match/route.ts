import { SKETCH_RULES } from "@/constants";
import { fail, okLive } from "@/lib/api-response";
import { backendPost, callerAuth } from "@/lib/backend";
import { artworkFail, toMatch, type BackendDrawResponse } from "@/lib/contest-bff";
import type { SketchPoint } from "@/types";

const UPSTREAM = "/api/artwork/draw";

const isPoint = (p: unknown): p is SketchPoint =>
  typeof p === "object" && p !== null && Number.isFinite((p as SketchPoint).x) && Number.isFinite((p as SketchPoint).y);

/**
 * 그린 점 → 곡·좌표·모양 일치도 (S15P21A405-598 · 640) — `POST /api/artwork/draw`.
 * 좌표는 캔버스 기준 0~1(y 아래). 점 수는 화면이 먼저 막지만 여기서도 한 번 더 본다 — 서버 400 을 우리 말로 바꾸려는 것.
 * 닫힘(`closed`)은 보내지 않는다 — 매칭과 무관한 표시 옵션이다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { points?: unknown };
  const points = Array.isArray(body.points) ? body.points.filter(isPoint) : [];
  const { minPoints, maxPoints } = SKETCH_RULES;
  if (points.length < minPoints || points.length > maxPoints) return fail("VALIDATION_ERROR", `점은 ${minPoints}~${maxPoints}개여야 합니다.`, 400);

  try {
    const res = await backendPost<BackendDrawResponse>(UPSTREAM, { points: points.map((p) => ({ x: p.x, y: p.y })) }, { headers: callerAuth(req) });
    return okLive(toMatch(res), UPSTREAM);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
