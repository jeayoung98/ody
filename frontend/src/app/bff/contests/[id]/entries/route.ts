import { CONTEST_DEFAULT_RULES, CONTEST_SORTS } from "@/constants";
import { fail, ok } from "@/lib/api-response";
import { contestCaller, contestFail, parseId } from "@/lib/contest-bff";
import { contestIdMatches, listEntries, submitEntry } from "@/mocks/contest";
import type { ContestSort, ContestTrack } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

const isSort = (v: string | null): v is ContestSort => CONTEST_SORTS.some((s) => s.key === v);

/** ⚠ **목이다** — 갤러리 목록. `?sort=latest|votes|ai|final|saves`. `sort=final` 이 곧 순위다 */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const contestId = parseId(id);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);
  const sort = new URL(req.url).searchParams.get("sort");
  try {
    return ok(await listEntries(contestCaller(req).email, isSort(sort) ? sort : "latest"));
  } catch (e) {
    return contestFail(e);
  }
}

/**
 * ⚠ **목이다** — 출품. body `{ title, tracks: ContestTrack[], closed }`.
 * 내 출품작이 이미 있으면 **대체**한다 (재출품 횟수 소모, 표는 유지). 점수는 여기서 다시 매기되
 * 같은 배치면 미리보기와 같은 값이다.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const contestId = parseId(id);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);

  const body = (await req.json().catch(() => ({}))) as { title?: unknown; tracks?: unknown; closed?: unknown };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const tracks = Array.isArray(body.tracks) ? (body.tracks as ContestTrack[]) : [];
  const { minPoints, maxPoints, titleMax } = CONTEST_DEFAULT_RULES;
  if (!title || title.length > titleMax) return fail("VALIDATION_ERROR", `별자리 이름은 1~${titleMax}자여야 합니다.`, 400);
  if (tracks.length < minPoints || tracks.length > maxPoints) return fail("VALIDATION_ERROR", `곡은 ${minPoints}~${maxPoints}개여야 합니다.`, 400);
  if (new Set(tracks.map((t) => t.musicId)).size !== tracks.length) return fail("VALIDATION_ERROR", "같은 곡이 두 번 들어 있습니다.", 400);

  const me = contestCaller(req);
  try {
    return ok(await submitEntry(me.email, me.nickname, { title, tracks, closed: body.closed === true }), 201);
  } catch (e) {
    return contestFail(e);
  }
}
