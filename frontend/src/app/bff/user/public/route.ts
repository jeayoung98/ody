import { fail, failLive, okLive } from "@/lib/api-response";
import { backendPatch, BackendError, callerAuth } from "@/lib/backend";

const UPSTREAM = "/api/user/public";

/**
 * 공개 계정 설정 (USER-02) — **배포 백엔드 실연동** (S15P21A405-470).
 * 비공개면 남이 내 프로필을 열거나 따라갈 수 없다. 누구의 설정인지는 토큰으로 정해진다.
 */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { isPublic?: unknown };
  if (typeof body.isPublic !== "boolean") return fail("VALIDATION_ERROR", "isPublic 이 필요합니다.", 400);

  try {
    const data = await backendPatch<{ isPublic: boolean }>(UPSTREAM, { isPublic: body.isPublic }, { headers: callerAuth(req) });
    return okLive(data, UPSTREAM);
  } catch (e) {
    const err = e as BackendError;
    return failLive("INTERNAL_ERROR", err.message, err.status || 502, UPSTREAM);
  }
}
