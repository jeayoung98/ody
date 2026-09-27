import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError, type BackendMusicLikeResponse } from "@/lib/backend";

/**
 * 곡 좋아요 (S15P21A405-611) — **실연동**. 백엔드 `POST /api/music/like`, 본문 `{musicId, liked}`.
 *
 * **`liked` 는 토글이 아니라 목표 상태다** — 플레이리스트 좋아요와 같은 규칙이다. 같은 요청을 반복해도
 * 결과가 같다. 누가 눌렀는지는 토큰이 말하므로 호출자 토큰으로 부른다 (`backendFetch` 기본).
 */
export async function POST(req: Request) {
  const upstream = "/api/music/like";
  try {
    const body = (await req.json()) as { musicId: number; liked: boolean };
    const res = await backendPost<BackendMusicLikeResponse>(upstream, body);
    return okLive({ liked: res.liked }, upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.status === 404 ? "MUSIC_NOT_FOUND" : err.status === 400 ? "INVALID_INPUT" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
