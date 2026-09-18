import { failLive, okLive } from "@/lib/api-response";
import { backendGet, BackendError, callerAuth, toUserProfile, type BackendUserDetail } from "@/lib/backend";

/**
 * 마이페이지 · 남의 프로필 (USER-02/04) — **배포 백엔드 실연동** (S15P21A405-462).
 *
 * `isFollowing` 처럼 **보는 사람에 따라 답이 달라지는 필드**가 있어서 호출자 자격으로 부른다.
 * 백엔드에 없는 값(지금 듣는 곡 · 만남 횟수 · 대시보드 통계 · 따라가는 대상)은 빈 값으로 온다 —
 * 자세한 것은 `toUserProfile` 과 BACKEND-NOTES A-35.
 */
export async function GET(req: Request, { params }: { params: Promise<{ email: string }> }) {
  const { email } = await params;
  const upstream = `/api/user/detail?email=${encodeURIComponent(decodeURIComponent(email))}`;
  try {
    const data = await backendGet<BackendUserDetail>(upstream, { headers: callerAuth(req) });
    return okLive(toUserProfile(data), upstream);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, upstream);
  }
}
