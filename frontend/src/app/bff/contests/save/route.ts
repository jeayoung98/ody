import { fail, okLive } from "@/lib/api-response";
import { backendPost, callerAuth } from "@/lib/backend";
import { artworkFail } from "@/lib/contest-bff";

const UPSTREAM = "/api/playlist/create";

/**
 * 남의 작품을 **내 플레이리스트로** (S15P21A405-640) — 전용 API 가 없어 `POST /api/playlist/create` 에 작품 `points` 의
 * `musicId` 를 순서대로 싣는다 (§6-9 대응표). 가져간 수는 세지 않는다(백엔드 범위 밖).
 * 몸: `{ playlistName, musicIds }`. 같은 이름이 있으면 409 `PLAYLIST_NAME_DUPLICATED` 가 그대로 올라간다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { playlistName?: unknown; musicIds?: unknown };
  const playlistName = typeof body.playlistName === "string" ? body.playlistName.trim() : "";
  const musicIds = Array.isArray(body.musicIds) ? body.musicIds.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
  if (!playlistName) return fail("VALIDATION_ERROR", "플레이리스트 이름이 필요합니다.", 400);
  if (musicIds.length === 0) return fail("VALIDATION_ERROR", "가져올 곡이 없습니다.", 400);
  try {
    const res = await backendPost<{ playlistId: number }>(UPSTREAM, { playlistName, musicIdList: musicIds }, { headers: callerAuth(req) });
    return okLive({ playlistId: res.playlistId }, UPSTREAM, 201);
  } catch (e) {
    return artworkFail(e, UPSTREAM);
  }
}
