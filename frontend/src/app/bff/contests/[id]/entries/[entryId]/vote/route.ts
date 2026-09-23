import { fail, ok } from "@/lib/api-response";
import { contestCaller, contestFail, parseId } from "@/lib/contest-bff";
import { contestIdMatches, vote } from "@/mocks/contest";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

/** ⚠ **목이다** — 표 주기(POST)·거두기(DELETE). 회차당 3표, 내 출품작 금지 */
async function handle(req: Request, ctx: Ctx, on: boolean) {
  const { id, entryId } = await ctx.params;
  const contestId = parseId(id);
  const eid = parseId(entryId);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);
  if (!eid) return fail("CONTEST_ENTRY_NOT_FOUND", "없는 출품작입니다.", 404);
  try {
    return ok(await vote(contestCaller(req).email, eid, on));
  } catch (e) {
    return contestFail(e);
  }
}

export const POST = (req: Request, ctx: Ctx) => handle(req, ctx, true);
export const DELETE = (req: Request, ctx: Ctx) => handle(req, ctx, false);
