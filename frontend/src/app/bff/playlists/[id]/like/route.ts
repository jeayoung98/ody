import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError, type BackendPlaylistLikeResponse } from "@/lib/backend";

/**
 * 플레이리스트 좋아요 (S15P21A405-492, BACKEND-NOTES A-41) — **실연동**. 501 을 주던 자리다.
 *
 * **`liked` 는 토글이 아니라 목표 상태다.** 화면이 "지금 눌려 있지 않으니 true" 를 보낸다 —
 * 서버가 뒤집는 방식이면 요청이 두 번 나갔을 때 원래대로 돌아와 버린다. 목표 상태로 보내면
 * 같은 요청을 반복해도 결과가 같다(멱등).
 *
 * 남의 플레이리스트에도 누를 수 있다. 응답의 `likeCnt` 는 **변경 후** 값이다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const upstream = "/api/playlist/like";
  try {
    const { liked } = (await req.json()) as { liked: boolean };
    const res = await backendPost<BackendPlaylistLikeResponse>(upstream, { playlistId: Number(id), liked });
    return okLive({ isLiked: res.liked, likeCnt: res.likeCnt }, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.status === 404 ? "PLAYLIST_NOT_FOUND" : err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
