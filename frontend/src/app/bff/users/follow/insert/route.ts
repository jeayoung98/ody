import { failLive, okLive } from "@/lib/api-response";
import { backendPost, BackendError } from "@/lib/backend";
import type { FollowResponse } from "@/types";

/**
 * 팔로우 등록 (S15P21A405-489, BACKEND-NOTES A-37) — **실연동**. 목이었다.
 *
 * 거는 쪽은 토큰 주체라 본문에 없다. 호출자 토큰은 `backendFetch` 가 넘긴다 (S15P21A405-481) —
 * 이 API 는 **누가** 거는지가 곧 내용이라 서비스 토큰으로 부르면 전부 한 사람이 건 게 된다.
 */
export async function POST(req: Request) {
  const upstream = "/api/user/follow/insert";
  try {
    const body = (await req.json()) as { followeeEmail: string };
    return okLive(await backendPost<FollowResponse>(upstream, body), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive(followCode(err.status), err.message, err.status || 502, upstream);
  }
}

/** A-37 의 오류를 화면이 가를 수 있게 옮긴다 — 문구가 달라야 하는 것들이다 */
export const followCode = (status: number) =>
  status === 400 ? "SELF_FOLLOW_NOT_ALLOWED" : status === 404 ? "USER_NOT_FOUND" : status === 409 ? "ALREADY_FOLLOWING" : "INTERNAL_ERROR";
