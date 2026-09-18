import { fail, failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, callerAuth, emailFromToken, toPlaylistSummary, type BackendPlaylistSummary } from "@/lib/backend";

/**
 * 내 플레이리스트 목록 — **배포 백엔드 실연동** (S15P21A405-468).
 * 백엔드 `GET /api/playlist/search` 는 `email` 을 요구하는데 "내 것" 이라는 뜻의 파라미터가 없다.
 * 그래서 토큰의 `sub` 를 쓴다 (내 정보와 같은 우회 — BACKEND-NOTES A-15).
 */
export async function GET(req: Request) {
  const email = emailFromToken(req);
  if (!email) return fail("UNAUTHENTICATED", "인증이 필요합니다.", 401);

  const upstream = `/api/playlist/search?email=${encodeURIComponent(email)}`;
  try {
    const res = await backendGet<{ content: BackendPlaylistSummary[] }>(upstream, { headers: callerAuth(req) });
    return okLive((res.content ?? []).map(toPlaylistSummary), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
