import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, emailFromToken, type BackendLikedPlaylistSummary } from "@/lib/backend";
import type { PlaylistSummary } from "@/types";

/**
 * 좋아요한 플레이리스트 (S15P21A405-492, BACKEND-NOTES A-44) — **실연동**. 빈 배열을 주던 자리다.
 *
 * **남이 만든 플리가 섞인다** — 좋아요는 남의 것에도 누를 수 있어서 소유자가 함께 온다.
 * 정렬은 좋아요를 누른 시각 역순이고 페이지네이션이 없다(`/playlist/search` 와 같다).
 *
 * `email` 은 목록 소유자가 아니라 **좋아요를 누른 사람**이다. 안 주면 토큰 주체로 부른다 —
 * 백엔드에 "내 것" 을 뜻하는 별도 경로가 없어서 `/bff/auth/me` 와 같은 우회를 쓴다 (A-15).
 *
 * **`?email=` 을 주면 그 사람이 좋아요한 목록이다** (S15P21A405-587). 남의 피드에도 떠야 한다
 * (USER-04). 공개 범위는 백엔드가 호출자 토큰으로 판정한다 — 여기서 또 거르지 않는다.
 */
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") || emailFromToken(req);
  if (!email) return failLive("UNAUTHENTICATED", "인증이 필요합니다.", 401, "/api/playlist/liked");

  const upstream = `/api/playlist/liked?email=${encodeURIComponent(email)}`;
  try {
    const res = await backendGet<{ content: BackendLikedPlaylistSummary[] }>(upstream);
    return okLive(res.content.map(toSummary), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.code === "USER_PRIVATE" ? "USER_PRIVATE" : err.status === 404 ? "USER_NOT_FOUND" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}

/** 소유자 닉네임이 **실제로 온다** — `/playlist/search` 요약과 다른 점이다 (거기는 null) */
const toSummary = (p: BackendLikedPlaylistSummary): PlaylistSummary => ({
  id: p.playlistId,
  playlistName: p.playlistName,
  likeCnt: p.likeCnt,
  itemCount: p.musicCnt,
  ownerNickname: p.ownerNickname,
});
