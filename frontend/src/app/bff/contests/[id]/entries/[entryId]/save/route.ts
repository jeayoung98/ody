import { fail, failLive, ok, okLive } from "@/lib/api-response";
import { backendPost, BackendError, callerAuth, isBackendEnabled } from "@/lib/backend";
import { contestCaller, contestFail, parseId } from "@/lib/contest-bff";
import { contestIdMatches, findEntry, markSaved } from "@/mocks/contest";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

const UPSTREAM = "/api/playlist/create";

/**
 * 출품작을 **내 플레이리스트로 가져온다** (남의 것도 가능). body `{ title? }`.
 *
 * 콘테스트 자체는 목이지만 **플레이리스트는 진짜로 만든다** — 백엔드가 켜져 있으면
 * `POST /api/playlist/create` 에 스냅샷 곡 순서 그대로 `musicIdList` 를 실어 보낸다 (호출자 자격).
 * 별밭이 진짜 곡이라(`mocks/contest.ts` 의 `starField`) 곡 ID 가 백엔드에 있다.
 * 백엔드가 꺼져 있으면(`USE_MOCK_API=1`) 가져간 기록만 남기고 `playlistId: null` 을 준다.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id, entryId } = await params;
  const contestId = parseId(id);
  const eid = parseId(entryId);
  if (!contestId || !contestIdMatches(contestId)) return fail("CONTEST_NOT_FOUND", "없는 회차입니다.", 404);
  if (!eid) return fail("CONTEST_ENTRY_NOT_FOUND", "없는 출품작입니다.", 404);

  const body = (await req.json().catch(() => ({}))) as { title?: unknown };
  const me = contestCaller(req);

  let entry;
  try {
    entry = await findEntry(eid);
  } catch (e) {
    return contestFail(e);
  }
  const playlistName = (typeof body.title === "string" && body.title.trim()) || entry.title;
  const musicIdList = entry.tracks.map((t) => t.musicId);

  // 목 모드 — 플리를 만들 곳이 없다. 가져간 기록만 남긴다
  if (!isBackendEnabled()) {
    const saved = await markSaved(me.email, eid);
    return ok({ playlistId: null, saveCount: saved.saveCount });
  }

  // **플리가 실제로 만들어진 뒤에** 가져갔다고 기록한다 — 먼저 적어 두면 실패해도 "가져감" 으로 남는다 (로컬 실측)
  try {
    const res = await backendPost<{ playlistId: number }>(UPSTREAM, { playlistName, musicIdList }, { headers: callerAuth(req) });
    const saved = await markSaved(me.email, eid);
    return okLive({ playlistId: res.playlistId, saveCount: saved.saveCount }, UPSTREAM, 201);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.code === "PLAYLIST_NAME_DUPLICATED" ? "PLAYLIST_NAME_DUPLICATED" : "INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
