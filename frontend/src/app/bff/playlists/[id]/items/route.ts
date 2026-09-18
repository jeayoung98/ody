import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/playlist/music/insert";

/**
 * 플리에 곡 추가 — **배포 백엔드 실연동** (S15P21A405-468).
 * 백엔드는 곡을 **배열**로 받고 경로에 플리 ID 를 두지 않는다. 프론트 경로는 REST 모양 그대로
 * 두고 여기서 옮겨 담는다 (곡 신고 A-28 과 같은 방식).
 *
 * 이미 들어 있는 곡은 백엔드가 `skippedMusicIds` 로 걸러 준다 — 중복 추가가 에러가 아니다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlistId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { musicId?: number };
  if (!playlistId || !body.musicId) return fail("VALIDATION_ERROR", "playlistId 와 musicId 가 필요합니다.", 400);

  try {
    const res = await backendPost<{ playlistId: number; insertedCnt: number; skippedCnt: number; musicCnt: number }>(
      UPSTREAM,
      { playlistId, musicIdList: [body.musicId] },
      { headers: callerAuth(req) },
    );
    return okLive(res, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("PLAYLIST_NOT_FOUND", err.message, err.status || 502, UPSTREAM);
  }
}
