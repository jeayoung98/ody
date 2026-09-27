import { fail, failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, callerAuth, emailFromToken, toPlaylistSummary, type BackendPlaylistSummary } from "@/lib/backend";

/**
 * 만든 플레이리스트 목록 — **배포 백엔드 실연동** (S15P21A405-468).
 * 백엔드 `GET /api/playlist/search` 는 `email` 을 요구하는데 "내 것" 이라는 뜻의 파라미터가 없다.
 * 그래서 안 주면 토큰의 `sub` 를 쓴다 (내 정보와 같은 우회 — BACKEND-NOTES A-15).
 *
 * **`?email=` 을 주면 그 사람 것이다** (S15P21A405-587). 백엔드가 처음부터 이메일로 아무나
 * 조회하는 API 라 새로 받을 것이 없었다 — 우리 쪽만 토큰 주체로 박아 두고 있었다.
 * 남의 피드에도 플리 목록이 떠야 한다 (USER-04 "마이페이지와 레이아웃 동일").
 *
 * **아무 이메일이나 넘겨도 여기서 더 막지 않는다.** 백엔드가 호출자 토큰으로 제 공개 범위를
 * 판정하므로, 여기서 한 번 더 거르면 그 규칙이 두 군데로 갈라진다.
 */
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") || emailFromToken(req);
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
