import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/playlist/music/reorder";

/**
 * 플리 곡 순서 바꾸기 — **배포 백엔드 실연동** (S15P21A405-540).
 *
 * **바뀐 곡 하나가 아니라 전체 순서를 보낸다.** 백엔드가 `musicIdList` 를 새 순서 그대로 받고
 * 그대로 다시 매긴다. "3번을 1번으로" 같은 부분 지시를 받지 않으므로 프론트가 결과 배열을 만들어
 * 통째로 넘긴다 — 중간에 다른 곳에서 곡이 추가·삭제됐다면 그 결과는 다음 조회 때 맞춰진다.
 *
 * 경로를 `items/order` 가 아니라 `order` 로 둔 이유는 **`items/[musicId]` 와 헷갈리지 않게** 하려는
 * 것이다. Next 는 정적 조각을 동적 조각보다 먼저 맞추므로 `items/order` 도 동작은 하지만,
 * 읽는 사람이 "order 라는 곡" 인지 매번 되짚어야 한다.
 *
 * 주인만 바꿀 수 있으므로 **호출자 자격으로** 부른다.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlistId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { musicIds?: number[] };
  const musicIdList = body.musicIds;
  if (!playlistId || !Array.isArray(musicIdList) || musicIdList.length === 0) {
    return fail("VALIDATION_ERROR", "playlistId 와 musicIds 가 필요합니다.", 400);
  }

  try {
    const res = await backendPost<{ playlistId: number; musicCnt: number }>(
      UPSTREAM,
      { playlistId, musicIdList },
      { headers: callerAuth(req) },
    );
    return okLive(res, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    /**
     * **로그인이 풀린 것과 플리가 없는 것을 가른다.** 옆 라우트들은 전부 `PLAYLIST_NOT_FOUND`
     * 로 뭉뚱그리는데, 그러면 토큰이 만료된 사용자에게 "플레이리스트를 찾을 수 없습니다" 가
     * 뜬다 — 다시 로그인하면 되는 상황인데 그 말이 어디에도 없다.
     */
    const code = err.status === 401 || err.status === 403 ? "UNAUTHENTICATED" : "PLAYLIST_NOT_FOUND";
    return failLive(code, err.message, err.status || 502, UPSTREAM);
  }
}
