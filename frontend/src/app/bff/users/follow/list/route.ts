import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError } from "@/lib/backend";
import type { FollowListResponse } from "@/types";

/**
 * 팔로워·팔로잉 목록 (S15P21A405-489, BACKEND-NOTES A-39) — **실연동**.
 *
 * `isFollowing`·`meetingCnt` 가 목록 소유자가 아니라 **토큰 주체 기준**이라 호출자 자격으로
 * 불러야 한다. 비공개 사용자의 목록은 본인만 볼 수 있다(`USER_PRIVATE`).
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const upstream = `/api/user/follow/list?email=${encodeURIComponent(q.get("email") ?? "")}&type=${q.get("type") ?? "follower"}&page=${q.get("page") ?? 0}`;
  try {
    return okLive(await backendGet<FollowListResponse>(upstream), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(err.code === "USER_PRIVATE" ? "USER_PRIVATE" : err.status === 404 ? "USER_NOT_FOUND" : "INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
