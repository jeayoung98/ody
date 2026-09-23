import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { FollowResponse } from "@/types";

/**
 * 팔로우 해제 (S15P21A405-489, BACKEND-NOTES A-38) — **실연동**.
 * 팔로우 중이 아니어도 200 이다(멱등). 그래서 화면이 상태를 먼저 확인할 필요가 없다.
 */
export async function POST(req: Request) {
  const upstream = "/api/user/follow/delete";
  try {
    const body = (await req.json()) as { followeeEmail: string };
    return okLive(await backendPost<FollowResponse>(upstream, body), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.status === 404 ? "USER_NOT_FOUND" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
